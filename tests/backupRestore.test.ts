import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { planImport, runBackupImport } from '../src/models/importPlan';
import { runStagedBackupImport, type MediaPort } from '../src/models/backupRestore';
import { buildBackup, BACKUP_VERSION, emptyData, type BackupFile } from '../src/models/backup';
import { buildFullBackupWithReport } from '../src/models/mediaBackup';
import { sha256Hex, base64ToBytes, hashContent } from '../src/models/hash';
import { MemoryCareRepository } from '../src/data/MemoryCareRepository';
import type { AppData, Baby, CareEvent, MilestoneRecord } from '../src/models/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};

const MILESTONE: MilestoneRecord = {
  id: 'c0000000-0000-4000-8000-000000000001',
  babyId: BABY.id,
  category: 'motor',
  title: 'First roll',
  date: '2026-09-20',
};

function babyPhotoBytes(seed: string): Uint8Array {
  return new TextEncoder().encode(`JPEGBYTES-${seed}`);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** A v5 backup carrying one baby photo and one milestone photo, genuinely hashed. */
function v5BackupWithPhotos(): { json: string; babyBytes: Uint8Array; msBytes: Uint8Array } {
  const babyBytes = babyPhotoBytes('baby');
  const msBytes = babyPhotoBytes('milestone');
  const data: AppData = {
    ...emptyData(),
    babies: [{ ...BABY, photoUri: 'file:///original-device/profile.jpg' }],
    milestones: [{ ...MILESTONE, photoUri: 'file:///original-device/roll.jpg' }],
  };
  const base = buildBackup(data, { themeMode: 'night' }) as unknown as Record<string, unknown>;
  const photosEmbedded = [
    {
      recordId: BABY.id,
      field: 'babyPhoto' as const,
      fileName: 'profile.jpg',
      base64: toBase64(babyBytes),
      sha256: sha256Hex(babyBytes),
      bytes: babyBytes.length,
      hashAlgo: 'sha256' as const,
    },
    {
      recordId: MILESTONE.id,
      field: 'milestonePhoto' as const,
      fileName: 'roll.jpg',
      base64: toBase64(msBytes),
      sha256: sha256Hex(msBytes),
      bytes: msBytes.length,
      hashAlgo: 'sha256' as const,
    },
  ];
  const file = {
    ...base,
    backupVersion: BACKUP_VERSION,
    photosEmbedded,
    mediaComplete: true,
    missingPhotos: [],
  };
  return { json: JSON.stringify(file), babyBytes, msBytes };
}

function recordsOnlyBackup(data: AppData): string {
  return JSON.stringify(buildBackup(data));
}

function seededRepo(): MemoryCareRepository {
  return new MemoryCareRepository();
}

function snapshot(repo: MemoryCareRepository): string {
  return JSON.stringify(repo.data);
}

// ---------------------------------------------------------------------------
// In-memory MediaPort (contract stand-in for the native file system — NOT a
// real SQLite/device integration test; native behaviour stays on the device
// test matrix).
// ---------------------------------------------------------------------------

interface PortFile {
  uri: string;
  bytes: Uint8Array;
}

function createMemoryMediaPort(opts: {
  failStageAt?: number;
  failPromoteAt?: number;
  promoteThrows?: Error;
} = {}): MediaPort & {
  staged: Map<string, Uint8Array>;
  promoted: Map<string, PortFile>;
  existing: Map<string, PortFile>;
  wipedStaging: number;
  rollbacks: number;
  preExisting(uri: string, bytes: Uint8Array): void;
} {
  const staged = new Map<string, Uint8Array>();
  const stagedMeta = new Map<string, { owner: string; name: string }>();
  const promoted = new Map<string, PortFile>();
  const existing = new Map<string, PortFile>();
  let stageCalls = 0;
  let promoteCalls = 0;
  let createdUris: string[] = [];
  const port = {
    staged,
    promoted,
    existing,
    wipedStaging: 0,
    rollbacks: 0,
    preExisting(uri: string, bytes: Uint8Array) {
      existing.set(uri, { uri, bytes });
    },
    async wipeStaging() {
      port.wipedStaging += 1;
      staged.clear();
      stagedMeta.clear();
    },
    async stage(payload: { key: string; ownerBabyId: string; base64: string; fileName: string }) {
      stageCalls += 1;
      if (opts.failStageAt !== undefined && stageCalls >= opts.failStageAt) {
        throw new Error('simulated: media directory unwritable');
      }
      // Defense-in-depth: the port itself must never write outside its root.
      const safe = payload.fileName.split(/[\\/]/).pop() ?? 'photo';
      staged.set(payload.key, base64ToBytes(payload.base64));
      stagedMeta.set(payload.key, { owner: payload.ownerBabyId, name: safe });
    },
    async promoteAll() {
      promoteCalls += 1;
      if (opts.promoteThrows) throw opts.promoteThrows;
      if (opts.failPromoteAt !== undefined && promoteCalls >= opts.failPromoteAt) {
        // partial promote: one file lands, then the failure hits
        for (const [key, bytes] of staged) {
          const uri = `file://managed/${stagedMeta.get(key)?.owner}/${key}.jpg`;
          promoted.set(uri, { uri, bytes });
          createdUris.push(uri);
          staged.delete(key);
          stagedMeta.delete(key);
          break;
        }
        throw new Error('simulated: promote failed midway');
      }
      const out = new Map<string, string>();
      for (const [key, bytes] of staged) {
        const uri = `file://managed/${stagedMeta.get(key)?.owner}/${key}.jpg`;
        promoted.set(uri, { uri, bytes });
        createdUris.push(uri);
        out.set(key, uri);
        staged.delete(key);
        stagedMeta.delete(key);
      }
      return out;
    },
    async rollback() {
      port.rollbacks += 1;
      for (const uri of createdUris) promoted.delete(uri);
      createdUris = [];
      staged.clear();
      stagedMeta.clear();
    },
    isManagedUri(uri: string) {
      return uri.startsWith('file://managed/');
    },
  };
  return port;
}

const refresh = vi.fn(async () => {});

// ---------------------------------------------------------------------------
// Scenario 5 first: the digest itself must be genuine SHA-256.
// ---------------------------------------------------------------------------

describe('genuine SHA-256 over original file bytes', () => {
  it('matches node crypto on known vectors and boundary lengths', () => {
    const vectors: Uint8Array[] = [
      new TextEncoder().encode(''),
      new TextEncoder().encode('abc'),
      new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      crypto.getRandomValues(new Uint8Array(55)),
      crypto.getRandomValues(new Uint8Array(56)),
      crypto.getRandomValues(new Uint8Array(64)),
      crypto.getRandomValues(new Uint8Array(1000)),
    ];
    for (const v of vectors) {
      const expected = createHash('sha256').update(v).digest('hex');
      expect(sha256Hex(v)).toBe(expected);
    }
  });

  it('decodes base64 to the original bytes (export/import byte equality)', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(257));
    expect(base64ToBytes(toBase64(bytes))).toEqual(bytes);
  });

  it('rejects a single tampered byte at plan time (v5, sha256)', () => {
    const { json } = v5BackupWithPhotos();
    const parsed = JSON.parse(json) as { photosEmbedded: Array<{ base64: string }> };
    const bytes = base64ToBytes(parsed.photosEmbedded[0].base64);
    bytes[3] ^= 0x01;
    parsed.photosEmbedded[0].base64 = toBase64(bytes);
    const plan = planImport(JSON.stringify(parsed), emptyData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.map((i) => i.message).join(' ')).toContain('integrity');
  });
});

// ---------------------------------------------------------------------------
// The staged restore workflow.
// ---------------------------------------------------------------------------

describe('staged backup restore (Task B workflow)', () => {
  it('1. fresh-device import restores records and photos with remapped URIs', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const media = createMemoryMediaPort();
    const plan = planImport(json, emptyData(), 'replace');
    expect(plan.ok).toBe(true);
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('complete');
    expect(result.restoredPhotos).toBe(2);
    // records point at the promoted (managed) URIs, not the original device's
    const baby = repo.data.babies.find((b) => b.id === BABY.id)!;
    const ms = repo.data.milestones.find((m) => m.id === MILESTONE.id)!;
    expect(baby.photoUri).toMatch(/^file:\/\/managed\//);
    expect(baby.photoUri).not.toContain('original-device');
    expect(ms.photoUri).toMatch(/^file:\/\/managed\//);
    // promoted bytes equal the original bytes
    expect(media.promoted.get(baby.photoUri!)?.bytes).toEqual(babyPhotoBytes('baby'));
    // nothing left staged after success
    expect(media.staged.size).toBe(0);
  });

  it('2. milestone photos land in the owning baby managed directory convention', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const media = createMemoryMediaPort();
    const plan = planImport(json, emptyData(), 'replace');
    await runStagedBackupImport(repo, plan, { media, refresh });
    for (const uri of media.promoted.keys()) {
      // final uri must sit under the baby's directory (per-baby orphan cleanup scope)
      expect(uri).toContain(String.raw`managed/${BABY.id}/`);
    }
  });

  it('3. export reports unreadable referenced photos instead of silent omission', async () => {
    const { Directory, Paths } = await import('expo-file-system');
    const managedRoot = new Directory(Paths.document, 'ninninest-media').uri;
    const data: AppData = {
      ...emptyData(),
      babies: [{ ...BABY, photoUri: `${managedRoot}/missing.jpg` }],
    };
    const { backup, missingPhotos } = await buildFullBackupWithReport(data, undefined, {
      readFileBase64: async () => null,
    });
    expect(missingPhotos).toHaveLength(1);
    expect(missingPhotos[0].recordId).toBe(BABY.id);
    expect(backup.mediaComplete).toBe(false);
    expect(backup.missingPhotos?.[0].recordId).toBe(BABY.id);
  });

  it('4. corrupted v5 photo bytes are a hard error at plan time (import never starts)', async () => {
    const { json } = v5BackupWithPhotos();
    const parsed = JSON.parse(json) as { photosEmbedded: Array<{ sha256: string }> };
    parsed.photosEmbedded[0].sha256 = sha256Hex(babyPhotoBytes('other'));
    const plan = planImport(JSON.stringify(parsed), emptyData(), 'replace');
    expect(plan.ok).toBe(false);
    const repo = seededRepo();
    await repo.init();
    const media = createMemoryMediaPort();
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('validation-failed');
    expect(media.staged.size).toBe(0);
  });

  it('6. unwritable media directory aborts BEFORE any database write', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const before = snapshot(repo);
    const media = createMemoryMediaPort({ failStageAt: 1 });
    const plan = planImport(json, emptyData(), 'replace');
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('storage-failed');
    expect(snapshot(repo)).toBe(before);
    expect(media.rollbacks).toBe(1);
  });

  it('7. write failure on a later photo releases earlier staged files, writes no DB', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const before = snapshot(repo);
    const media = createMemoryMediaPort({ failStageAt: 2 });
    const plan = planImport(json, emptyData(), 'replace');
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('storage-failed');
    expect(snapshot(repo)).toBe(before);
    expect(media.staged.size).toBe(0);
  });

  it('8. database failure rolls back promoted media and preserves old state', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const before = snapshot(repo);
    const media = createMemoryMediaPort();
    media.preExisting('file://managed/pre-existing.jpg', babyPhotoBytes('keep'));
    const plan = planImport(json, emptyData(), 'replace');
    repo.failNextReplace = true;
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('rolled-back');
    expect(snapshot(repo)).toBe(before);
    expect(media.promoted.size).toBe(0); // new files removed
    expect(media.existing.has('file://managed/pre-existing.jpg')).toBe(true); // old media kept
    expect(media.staged.size).toBe(0);
  });

  it('9. rollback removes only newly staged assets, never pre-existing media', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const media = createMemoryMediaPort();
    const keepBytes = babyPhotoBytes('keep-me');
    media.preExisting('file://managed/keep.jpg', keepBytes);
    repo.failNextReplace = true;
    const plan = planImport(json, emptyData(), 'replace');
    await runStagedBackupImport(repo, plan, { media, refresh });
    expect(media.promoted.size).toBe(0);
    expect(media.existing.get('file://managed/keep.jpg')?.bytes).toEqual(keepBytes);
  });

  it('10. a previous interrupted import leaves recoverable staging debris that the next run sweeps', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const media = createMemoryMediaPort();
    // simulate debris from a killed process
    media.staged.set('orphan-key', babyPhotoBytes('orphan'));
    const plan = planImport(json, emptyData(), 'replace');
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(true);
    expect(media.wipedStaging).toBeGreaterThanOrEqual(1);
    expect(media.staged.size).toBe(0);
  });

  it('11. merge keeps existing records (and their local photos) while adding restored ones', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const localPhoto = 'file://managed/local-baby.jpg';
    await repo.replaceAll({
      ...emptyData(),
      babies: [{ ...BABY, photoUri: localPhoto }],
      events: [
        { id: 'b0000000-0000-4000-8000-0000000000aa', babyId: BABY.id, type: 'diaper', timestamp: '2026-10-15T09:00:00.000Z', diaperType: 'wet' },
      ] as unknown as CareEvent[],
    });
    const media = createMemoryMediaPort();
    const currentAtPlan = repo.data;
    const plan = planImport(json, repo.data, 'merge');
    expect(plan.ok).toBe(true);
    const result = await runStagedBackupImport(repo, plan, { media, refresh, current: currentAtPlan });
    expect(result.ok).toBe(true);
    // merge kept the existing record untouched (id collision → local record wins)
    const baby = repo.data.babies.find((b) => b.id === BABY.id)!;
    expect(baby.photoUri).toBe(localPhoto);
    // the milestone is new, so it receives the restored URI
    const ms = repo.data.milestones.find((m) => m.id === MILESTONE.id)!;
    expect(ms.photoUri).toMatch(/^file:\/\/managed\//);
    expect(repo.data.events).toHaveLength(1);
  });

  it('12. identically named photos for different records never collide', async () => {
    const bytes1 = babyPhotoBytes('one');
    const bytes2 = babyPhotoBytes('two');
    const baby2: Baby = { ...BABY, id: 'a0000000-0000-4000-8000-000000000002', name: 'Ini' };
    const data: AppData = {
      ...emptyData(),
      babies: [{ ...BABY, photoUri: 'file:///orig/same.jpg' }, { ...baby2, photoUri: 'file:///orig/same.jpg' }],
    };
    const base = buildBackup(data) as unknown as Record<string, unknown>;
    const file = {
      ...base,
      photosEmbedded: [
        { recordId: BABY.id, field: 'babyPhoto', fileName: 'same.jpg', base64: toBase64(bytes1), sha256: sha256Hex(bytes1), bytes: bytes1.length, hashAlgo: 'sha256' },
        { recordId: baby2.id, field: 'babyPhoto', fileName: 'same.jpg', base64: toBase64(bytes2), sha256: sha256Hex(bytes2), bytes: bytes2.length, hashAlgo: 'sha256' },
      ],
    };
    const repo = seededRepo();
    await repo.init();
    const media = createMemoryMediaPort();
    const plan = planImport(JSON.stringify(file), emptyData(), 'replace');
    expect(plan.ok).toBe(true);
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(true);
    const uris = repo.data.babies.map((b) => b.photoUri);
    expect(new Set(uris).size).toBe(2);
    const first = media.promoted.get(uris[0]!)!;
    const second = media.promoted.get(uris[1]!)!;
    expect(first.bytes).toEqual(bytes1);
    expect(second.bytes).toEqual(bytes2);
  });

  it('13. duplicate and record-less photo manifest entries are rejected', () => {
    const bytes = babyPhotoBytes('x');
    const entry = { recordId: BABY.id, field: 'babyPhoto', fileName: 'p.jpg', base64: toBase64(bytes), sha256: sha256Hex(bytes), hashAlgo: 'sha256' };
    const dup = v5File({ photosEmbedded: [entry, { ...entry }] }, [BABY]);
    const plan = planImport(dup, emptyData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.map((i) => i.message).join(' ')).toMatch(/duplicate/i);

    const orphan = v5File({ photosEmbedded: [{ ...entry, recordId: 'e0000000-0000-4000-8000-000000000009' }] }, [BABY]);
    const plan2 = planImport(orphan, emptyData(), 'replace');
    expect(plan2.ok).toBe(false);
    expect(plan2.issues.map((i) => i.message).join(' ')).toMatch(/record/i);
  });

  it('14. traversal-style photo filenames are rejected, never written outside managed storage', () => {
    const bytes = babyPhotoBytes('evil');
    const evil = v5File({
      photosEmbedded: [
        { recordId: BABY.id, field: 'babyPhoto', fileName: '../../evil.png', base64: toBase64(bytes), sha256: sha256Hex(bytes), hashAlgo: 'sha256' },
      ],
    }, [BABY]);
    const plan = planImport(evil, emptyData(), 'replace');
    expect(plan.ok).toBe(false);
  });

  it('15. legacy v4 backups verify with the legacy checksum and are never reinterpreted as SHA-256', () => {
    const bytes = babyPhotoBytes('legacy');
    const b64 = toBase64(bytes);
    const correctLegacy = v5File({
      backupVersion: 4,
      photosEmbedded: [{ recordId: BABY.id, field: 'babyPhoto', fileName: 'p.jpg', base64: b64, sha256: hashContent(b64) }],
    }, [BABY]);
    expect(planImport(correctLegacy, emptyData(), 'replace').ok).toBe(true);

    // A v4 file whose sha256 holds a genuine SHA-256 (not the legacy checksum)
    // must FAIL the legacy verification — the field's meaning is never silently switched.
    const reinterpreted = v5File({
      backupVersion: 4,
      photosEmbedded: [{ recordId: BABY.id, field: 'babyPhoto', fileName: 'p.jpg', base64: b64, sha256: sha256Hex(bytes) }],
    }, [BABY]);
    const plan = planImport(reinterpreted, emptyData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.map((i) => i.message).join(' ')).toContain('integrity');
  });

  it('16. repeated imports create no duplicate records and leave consistent state', async () => {
    const { json } = v5BackupWithPhotos();
    const repo = seededRepo();
    await repo.init();
    const media1 = createMemoryMediaPort();
    const plan1 = planImport(json, emptyData(), 'merge');
    await runStagedBackupImport(repo, plan1, { media: media1, refresh });
    const eventsAfterFirst = repo.data.events.length;
    const babiesAfterFirst = repo.data.babies.length;
    const media2 = createMemoryMediaPort();
    const plan2 = planImport(json, repo.data, 'merge');
    await runStagedBackupImport(repo, plan2, { media: media2, refresh });
    expect(repo.data.events).toHaveLength(eventsAfterFirst);
    expect(repo.data.babies).toHaveLength(babiesAfterFirst);
  });
});

// ---------------------------------------------------------------------------
// Records-only backups keep working; dangling photo references are handled honestly.
// ---------------------------------------------------------------------------

describe('records-only and legacy limitations (Task D honesty)', () => {
  it('a records-only backup imports with outcome records-only and clears dangling foreign photo URIs', async () => {
    const data: AppData = {
      ...emptyData(),
      babies: [{ ...BABY, photoUri: 'file:///original-device/profile.jpg' }],
      milestones: [{ ...MILESTONE, photoUri: 'file:///original-device/roll.jpg' }],
    };
    const repo = seededRepo();
    await repo.init();
    const media = createMemoryMediaPort();
    const plan = planImport(recordsOnlyBackup(data), emptyData(), 'replace');
    expect(plan.ok).toBe(true);
    expect(plan.issues.some((i) => i.severity === 'warning')).toBe(true);
    const result = await runStagedBackupImport(repo, plan, { media, refresh });
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('records-only');
    const baby = repo.data.babies.find((b) => b.id === BABY.id)!;
    // the foreign URI pointed at a file that does not exist on this device —
    // keeping it would render a broken image forever
    expect(baby.photoUri).toBeUndefined();
  });

  it('existing local photos in merge mode are never cleared', async () => {
    const data: AppData = {
      ...emptyData(),
      babies: [{ ...BABY, photoUri: 'file:///original-device/profile.jpg' }],
    };
    const repo = seededRepo();
    await repo.init();
    const localPhoto = 'file://managed/local.jpg';
    await repo.replaceAll({ ...emptyData(), babies: [{ ...BABY, photoUri: localPhoto }] });
    const media = createMemoryMediaPort();
    const currentAtPlan = repo.data;
    const plan = planImport(recordsOnlyBackup(data), repo.data, 'merge');
    await runStagedBackupImport(repo, plan, { media, refresh, current: currentAtPlan });
    expect(repo.data.babies.find((b) => b.id === BABY.id)!.photoUri).toBe(localPhoto);
  });
});

// ---------------------------------------------------------------------------
// The old records-only workflow keeps its Stage-1 guarantee: a rejected DB
// write never invokes media restoration.
// ---------------------------------------------------------------------------

describe('runBackupImport (records path) keeps its committed guarantees', () => {
  it('a rejected database write never invokes media restoration', async () => {
    const repo = seededRepo();
    await repo.init();
    const plan = planImport(recordsOnlyBackup({ ...emptyData(), babies: [BABY] }), emptyData(), 'replace');
    repo.failNextReplace = true;
    const restorePhotos = vi.fn(async () => new Map<string, string>());
    const refreshFn = vi.fn(async () => {});
    const message = await runBackupImport(repo, plan, { restorePhotos, refresh: refreshFn });
    expect(message).toContain('failed while writing');
    expect(restorePhotos).not.toHaveBeenCalled();
    expect(refreshFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function v5File(overrides: Record<string, unknown>, babies: Baby[]): string {
  const base = buildBackup({ ...emptyData(), babies }) as unknown as Record<string, unknown>;
  return JSON.stringify({ ...base, backupVersion: 5, ...overrides });
}

// keep the BackupFile type honest in fixtures
const _typeCheck: BackupFile | null = null;
