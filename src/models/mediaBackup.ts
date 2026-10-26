import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import type { BackupFile, EmbeddedPhotoData, MissingPhotoRef, PhotoManifestEntry } from './backup';
import { buildBackup } from './backup';
import { base64ToBytes, bytesToBase64, hashContent, sha256Hex } from './hash';
import type { AppData, MilestoneRecord } from './types';

export { hashContent };

export type EmbeddedPhoto = EmbeddedPhotoData;

export interface FullBackup extends BackupFile {
  photosEmbedded: EmbeddedPhoto[];
}

/**
 * Genuine integrity metadata: v5 exports embed a SHA-256 hex digest of the
 * DECODED original bytes (hashAlgo: 'sha256') and the decoded byte count.
 * The legacy FNV checksum over the base64 text survives only for verifying
 * v4-and-older archives (see hash.ts).
 */

async function fileBase64(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const f = new File(uri);
    if (!f.exists) return null;
    const bytes = await f.bytes();
    return bytesToBase64(bytes);
  } catch {
    return null;
  }
}

// Collects all referenced media files and embeds their bytes into the backup.
// Photos that exist but cannot be read are REPORTED, never silently omitted —
// a caller can then tell the user the backup is incomplete.
export async function buildFullBackupWithReport(
  data: AppData,
  settings?: { themeMode?: string },
  opts?: { readFileBase64?: (uri: string) => Promise<string | null> }
): Promise<{ backup: FullBackup; missingPhotos: MissingPhotoRef[] }> {
  const base = buildBackup(data, settings);
  const photosEmbedded: EmbeddedPhoto[] = [];
  const missingPhotos: MissingPhotoRef[] = [];
  const read = opts?.readFileBase64 ?? fileBase64;
  // An injected reader (tests, tooling) can exercise collection even where the
  // default native reader is unavailable; production web keeps its no-managed-
  // media behavior.
  const canCollect = Platform.OS !== 'web' || !!opts?.readFileBase64;
  if (canCollect) {
    const managedRoot = new Directory(Paths.document, 'ninninest-media').uri;
    const collect = async (
      uri: string | undefined,
      recordId: string,
      field: PhotoManifestEntry['field']
    ) => {
      if (!uri || !uri.startsWith(managedRoot)) return;
      const b64 = await read(uri);
      if (b64 === null) {
        missingPhotos.push({ recordId, field, fileName: uri.split('/').pop() });
        return;
      }
      const bytes = base64ToBytes(b64);
      photosEmbedded.push({
        recordId,
        field,
        fileName: uri.split('/').pop() ?? 'photo',
        base64: b64,
        sha256: sha256Hex(bytes),
        bytes: bytes.length,
        hashAlgo: 'sha256',
      });
    };
    for (const baby of data.babies) {
      await collect(baby.photoUri, baby.id, 'babyPhoto');
    }
    for (const m of data.milestones) {
      await collect(m.photoUri, m.id, 'milestonePhoto');
    }
  }
  const backup: FullBackup = {
    ...base,
    photosEmbedded,
    mediaComplete: missingPhotos.length === 0,
    missingPhotos,
  };
  return { backup, missingPhotos };
}

// Convenience wrapper with the historical signature.
export async function buildFullBackup(
  data: AppData,
  settings?: { themeMode?: string }
): Promise<FullBackup> {
  return (await buildFullBackupWithReport(data, settings)).backup;
}

// ---------------------------------------------------------------------------
// MediaPort: the transaction-safe file side of a backup import. Staged files
// are quarantined under the managed root's .staging directory; promotion into
// final per-baby directories happens BEFORE the database commit, and rollback
// removes only files this import created — pre-existing media is never touched.
// ---------------------------------------------------------------------------

const MEDIA_ROOT_NAME = 'ninninest-media';
const STAGING_DIR_NAME = '.staging';

export interface MediaPort {
  /** Recovery sweep: remove staging debris from any interrupted import. */
  wipeStaging(): Promise<void>;
  /** Verify-and-quarantine one photo payload for this import. */
  stage(payload: {
    key: string;
    ownerBabyId: string;
    base64: string;
    fileName: string;
  }): Promise<void>;
  /** Move staged files into their final managed locations. key -> final uri. */
  promoteAll(): Promise<Map<string, string>>;
  /**
   * Delete every file this import created (staged and promoted). Returns the
   * number of files that could NOT be removed — a nonzero value means the
   * caller must tell the user cleanup was incomplete.
   */
  rollback(): Promise<number>;
  /** Whether a URI points into this device's managed media root. */
  isManagedUri(uri: string): boolean;
  /** Baby-id directories directly under the managed root (never .staging). */
  listManagedBabyIds(): Promise<string[]>;
  /** Remove unreferenced files from one baby's managed directory. */
  cleanupBabyFiles(
    babyId: string,
    referencedUris: Set<string>
  ): Promise<{ removed: number; failures: number }>;
  /** Remove one baby's whole directory (a profile the user erased via replace). */
  deleteBabyDirectory(babyId: string): Promise<number>;
}

/**
 * The primitives the port state machine needs from a filesystem. The native
 * expo-file-system runtime supplies one implementation; tests supply fakes
 * with failure injection and run the REAL state machine.
 */
export interface MediaPortIo {
  nowMs(): number;
  randomId(): string;
  joinPath(base: string, name: string): string;
  baseName(path: string): string;
  ensureDir(path: string): Promise<void>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  listChildDirs(base: string): Promise<string[]>;
  listChildFiles(base: string): Promise<string[]>;
  removeTree(path: string): Promise<void>;
  rootPath(): string;
  stagingPath(): string;
}

function safeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim();
  if (!base || base === '..' || base.length > 120) return `photo-${Date.now()}.jpg`;
  return base;
}

/** One path segment (a baby id) — never lets separators or dots through. */
function safeSegment(id: string): string {
  const seg = (id.split(/[\\/]/).pop() ?? '').replace(/^\.+/, '').trim();
  return seg && seg !== '..' ? seg : 'unknown';
}

/**
 * The staging/promotion/rollback state machine shared by every platform. All
 * fallible operations follow two rules:
 *   1. a file is tracked for rollback BEFORE the operation that creates it;
 *   2. only files this import created are ever removed.
 */
export function createManagedMediaPort(io: MediaPortIo): MediaPort {
  let staged: Array<{ key: string; owner: string; name: string; path: string }> = [];
  let promoted: string[] = [];

  const tryRemove = async (path: string): Promise<boolean> => {
    try {
      await io.removeFile(path);
      return true;
    } catch {
      return false;
    }
  };

  return {
    async wipeStaging() {
      try {
        await io.removeTree(io.stagingPath());
      } catch {
        // nothing to sweep or sweep blocked; the next import retries
      }
      staged = [];
      promoted = [];
    },
    async stage({ key, ownerBabyId, base64, fileName }) {
      const owner = safeSegment(ownerBabyId);
      const name = safeFileName(fileName);
      const path = io.joinPath(io.stagingPath(), `${io.nowMs()}-${io.randomId()}-${name}`);
      // Track BEFORE the fallible write: a partial write must still be
      // reachable by rollback() (and by the next wipeStaging()).
      staged.push({ key, owner, name, path });
      await io.ensureDir(io.stagingPath());
      await io.writeFile(path, base64ToBytes(base64));
    },
    async promoteAll() {
      const out = new Map<string, string>();
      for (const s of staged) {
        const dir = io.joinPath(io.rootPath(), s.owner);
        await io.ensureDir(dir);
        const dest = io.joinPath(dir, `${io.nowMs()}-${io.randomId()}-${s.name}`);
        await io.copyFile(s.path, dest);
        promoted.push(dest); // track the new copy before removing the staged one
        await tryRemove(s.path);
        out.set(s.key, dest);
      }
      staged = [];
      return out;
    },
    async rollback() {
      let failures = 0;
      for (const s of staged) if (!(await tryRemove(s.path))) failures += 1;
      for (const dest of promoted) if (!(await tryRemove(dest))) failures += 1;
      staged = [];
      promoted = [];
      return failures;
    },
    isManagedUri(uri) {
      return uri.startsWith(io.rootPath());
    },
    async listManagedBabyIds() {
      try {
        const dirs = await io.listChildDirs(io.rootPath());
        return dirs
          .map((d) => io.baseName(d))
          .filter((n) => n !== STAGING_DIR_NAME && n !== '' && n !== '..');
      } catch {
        return [];
      }
    },
    async cleanupBabyFiles(babyId, referencedUris) {
      const id = safeSegment(babyId);
      let removed = 0;
      let failures = 0;
      try {
        const dir = io.joinPath(io.rootPath(), id);
        const files = await io.listChildFiles(dir);
        for (const f of files) {
          if (referencedUris.has(f)) continue;
          if (await tryRemove(f)) removed += 1;
          else failures += 1;
        }
      } catch {
        failures += 1;
      }
      return { removed, failures };
    },
    async deleteBabyDirectory(babyId) {
      const id = safeSegment(babyId);
      let failures = 0;
      try {
        const dir = io.joinPath(io.rootPath(), id);
        const files = await io.listChildFiles(dir);
        for (const f of files) if (!(await tryRemove(f))) failures += 1;
        await io.removeTree(dir);
      } catch {
        failures += 1;
      }
      return failures;
    },
  };
}

function nativeIo(): MediaPortIo {
  const root = new Directory(Paths.document, MEDIA_ROOT_NAME);
  const staging = new Directory(root, STAGING_DIR_NAME);
  return {
    nowMs: () => Date.now(),
    randomId: () => crypto.randomUUID(),
    joinPath: (base, name) => `${base}/${name}`,
    baseName: (p) => p.split('/').pop() ?? p,
    ensureDir: async (path) => {
      new Directory(path).create({ intermediates: true, idempotent: true });
    },
    writeFile: async (path, bytes) => {
      await new File(path).write(bytes);
    },
    copyFile: async (src, dest) => {
      await new File(src).copy(new File(dest));
    },
    removeFile: async (path) => {
      const f = new File(path);
      if (f.exists) f.delete();
    },
    fileExists: async (path) => new File(path).exists,
    listChildDirs: async (base) => {
      const d = new Directory(base);
      if (!d.exists) return [];
      return d.list().filter((e): e is Directory => e instanceof Directory).map((e) => e.uri);
    },
    listChildFiles: async (base) => {
      const d = new Directory(base);
      if (!d.exists) return [];
      return d.list().filter((e): e is File => e instanceof File).map((e) => e.uri);
    },
    removeTree: async (path) => {
      const d = new Directory(path);
      if (d.exists) d.delete();
    },
    rootPath: () => root.uri,
    stagingPath: () => staging.uri,
  };
}

export function createMediaPort(): MediaPort {
  if (Platform.OS === 'web') {
    // Web has no managed media library (documented platform limitation);
    // imports proceed records-only through this no-op port.
    return {
      async wipeStaging() {},
      async stage() {},
      async promoteAll() {
        return new Map();
      },
      async rollback() {
        return 0;
      },
      isManagedUri() {
        return false;
      },
      async listManagedBabyIds() {
        return [];
      },
      async cleanupBabyFiles() {
        return { removed: 0, failures: 0 };
      },
      async deleteBabyDirectory() {
        return 0;
      },
    };
  }
  return createManagedMediaPort(nativeIo());
}

/**
 * DEPRECATED legacy path — writes straight to final locations and silently
 * skips failures. Kept only for the old records-first import workflow that the
 * current tests pin down. New code must use MediaPort + runStagedBackupImport.
 */
export async function restoreEmbeddedPhotos(
  photos: EmbeddedPhoto[]
): Promise<Map<string, string>> {
  const restored = new Map<string, string>();
  if (Platform.OS === 'web') return restored;
  const mediaRoot = new Directory(Paths.document, MEDIA_ROOT_NAME);
  for (const p of photos) {
    if (!p.base64) continue;
    if (p.sha256 && hashContent(p.base64) !== p.sha256) continue; // corrupted payload — skip
    try {
      const dir = new Directory(mediaRoot, p.recordId);
      dir.create({ intermediates: true, idempotent: true });
      const file = new File(dir, safeFileName(p.fileName));
      const bytes = base64ToBytes(p.base64);
      await file.write(bytes);
      restored.set(`${p.recordId}:${p.field}`, file.uri);
    } catch {
      // skip individual photo failures
    }
  }
  return restored;
}

/**
 * DEPRECATED legacy remap helper — the staged workflow remaps from promoted
 * URIs directly. Kept for the existing pure unit tests.
 */
export function remapEmbeddedPhotos(
  data: AppData,
  milestones: MilestoneRecord[],
  restored: Map<string, string>
): { data: AppData; milestones: MilestoneRecord[] } {
  const babies = data.babies.map((b) => {
    const uri = restored.get(`${b.id}:babyPhoto`);
    return uri ? { ...b, photoUri: uri } : b;
  });
  const remappedMilestones = milestones.map((m) => {
    const uri = restored.get(`${m.id}:milestonePhoto`);
    return uri ? { ...m, photoUri: uri } : m;
  });
  return { data: { ...data, babies }, milestones: remappedMilestones };
}
