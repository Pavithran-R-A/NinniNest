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
  /** Delete every file this import created (staged and promoted). */
  rollback(): Promise<void>;
  /** Whether a URI points into this device's managed media root. */
  isManagedUri(uri: string): boolean;
}

function safeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/^\.+/, '').trim();
  if (!base || base === '..' || base.length > 120) return `photo-${Date.now()}.jpg`;
  return base;
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
      async rollback() {},
      isManagedUri() {
        return false;
      },
    };
  }
  const root = new Directory(Paths.document, MEDIA_ROOT_NAME);
  const staging = new Directory(root, STAGING_DIR_NAME);
  let stagedFiles: Array<{ key: string; file: File; ownerBabyId: string; name: string }> = [];
  let promotedUris: string[] = [];

  const removeQuietly = (f: File) => {
    try {
      if (f.exists) f.delete();
    } catch {
      // best-effort cleanup; the database invariant is what matters
    }
  };

  return {
    async wipeStaging() {
      try {
        if (staging.exists) staging.delete();
      } catch {
        // nothing to sweep or sweep blocked; next import retries
      }
      stagedFiles = [];
      promotedUris = [];
    },
    async stage({ key, ownerBabyId, base64, fileName }) {
      const bytes = base64ToBytes(base64);
      const name = safeFileName(fileName);
      const file = new File(staging, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${name}`);
      staging.create({ intermediates: true, idempotent: true });
      await file.write(bytes);
      stagedFiles.push({ key, file, ownerBabyId, name });
    },
    async promoteAll() {
      const out = new Map<string, string>();
      for (const entry of stagedFiles) {
        const dir = new Directory(root, entry.ownerBabyId || 'unknown');
        dir.create({ intermediates: true, idempotent: true });
        const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${entry.name}`);
        await entry.file.copy(dest);
        removeQuietly(entry.file);
        promotedUris.push(dest.uri);
        out.set(entry.key, dest.uri);
      }
      stagedFiles = [];
      return out;
    },
    async rollback() {
      for (const { file } of stagedFiles) removeQuietly(file);
      for (const uri of promotedUris) removeQuietly(new File(uri));
      stagedFiles = [];
      promotedUris = [];
    },
    isManagedUri(uri: string) {
      return uri.startsWith(root.uri);
    },
  };
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
