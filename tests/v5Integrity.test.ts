import { describe, it, expect } from 'vitest';
import { planImport, applyImportPlan } from '../src/models/importPlan';
import { buildBackup, BACKUP_VERSION, emptyData } from '../src/models/backup';
import { sha256Hex, base64ToBytes, decodeBase64Strict, hashContent } from '../src/models/hash';
import { MemoryCareRepository } from '../src/data/MemoryCareRepository';
import type { AppData, Baby, MilestoneRecord } from '../src/models/types';

// ---------------------------------------------------------------------------
// Fixtures: a v5 backup with one baby + one milestone so manifest references
// are valid and ONLY the integrity dimension under test can fail.
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

const BYTES = new TextEncoder().encode('JPEGDATA-for-integrity-tests');
const B64 = Buffer.from(BYTES).toString('base64');
const DIGEST = sha256Hex(BYTES);

function dataWithPhotos(): AppData {
  return {
    ...emptyData(),
    babies: [{ ...BABY, photoUri: 'file:///orig-device/profile.jpg' }],
    milestones: [{ ...MILESTONE, photoUri: 'file:///orig-device/roll.jpg' }],
  };
}

interface PhotoEntry {
  recordId: string;
  field: 'babyPhoto' | 'milestonePhoto';
  fileName: string;
  base64?: string;
  sha256?: string;
  bytes?: number;
  hashAlgo?: string;
}

function v5Json(entries: PhotoEntry[], backupVersion: number = BACKUP_VERSION): string {
  const base = buildBackup(dataWithPhotos()) as unknown as Record<string, unknown>;
  return JSON.stringify({
    ...base,
    backupVersion,
    photosEmbedded: entries,
  });
}

const validV5Entry = (over: Partial<PhotoEntry> = {}): PhotoEntry => ({
  recordId: BABY.id,
  field: 'babyPhoto',
  fileName: 'profile.jpg',
  base64: B64,
  sha256: DIGEST,
  bytes: BYTES.length,
  hashAlgo: 'sha256',
  ...over,
});

function snapshot(repo: MemoryCareRepository): string {
  return JSON.stringify(repo.data);
}

/** A rejected plan must never mutate records via the apply path. */
async function rejectsWithoutMutation(json: string, messagePattern?: RegExp) {
  const repo = new MemoryCareRepository();
  await repo.init();
  await repo.replaceAll(dataWithPhotos());
  const before = snapshot(repo);
  const plan = planImport(json, emptyData(), 'replace');
  const errors = plan.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' ');
  expect(plan.ok).toBe(false);
  if (messagePattern) expect(errors).toMatch(messagePattern);
  const result = await applyImportPlan(repo, plan);
  expect(result.ok).toBe(false);
  expect(snapshot(repo)).toBe(before);
}

// ---------------------------------------------------------------------------
// Strict base64 decoding primitives.
// ---------------------------------------------------------------------------

describe('decodeBase64Strict (canonical base64 only)', () => {
  it('accepts canonical base64 including empty string', () => {
    expect(Array.from(decodeBase64Strict('')!)).toEqual([]);
    expect(Array.from(decodeBase64Strict('aGVsbG8=')!)).toEqual(Array.from(new TextEncoder().encode('hello')));
    expect(Array.from(decodeBase64Strict('+/w=')!)).toEqual([0xfb, 0xfc]);
  });

  it('rejects noncanonical shapes', () => {
    expect(decodeBase64Strict('aGVsbG8')).toBeNull(); // missing padding
    expect(decodeBase64Strict('aGVs bG8=')).toBeNull(); // whitespace
    expect(decodeBase64Strict('aGVsbG8==')).toBeNull(); // excess padding
    expect(decodeBase64Strict('aGVsbG8=aGVj')).toBeNull(); // padding mid-string
    expect(decodeBase64Strict('aGVs!bG8=')).toBeNull(); // invalid character
    expect(decodeBase64Strict('AB')).toBeNull(); // length not multiple of 4
    expect(decodeBase64Strict('a===')).toBeNull(); // triple padding
  });
});

// ---------------------------------------------------------------------------
// v5 entries claiming bytes must carry complete, valid cryptographic metadata.
// ---------------------------------------------------------------------------

describe('strict v5 integrity (bytes present)', () => {
  it('accepts a fully valid v5 entry', () => {
    const plan = planImport(v5Json([validV5Entry()]), emptyData(), 'replace');
    expect(plan.ok).toBe(true);
    expect(plan.photos).toHaveLength(1);
  });

  it('rejects a v5 entry with NO digest at all', async () => {
    const e = validV5Entry();
    delete e.sha256;
    await rejectsWithoutMutation(v5Json([e]), /integrity/i);
  });

  it('rejects a v5 entry that only carries a legacy-style checksum (missing hashAlgo)', async () => {
    const e = validV5Entry();
    delete e.hashAlgo;
    e.sha256 = hashContent(B64); // authentic v4-style checksum on a v5 file
    await rejectsWithoutMutation(v5Json([e]), /integrity|hash algorithm/i);
  });

  it('rejects unsupported hash algorithms', async () => {
    await rejectsWithoutMutation(v5Json([validV5Entry({ hashAlgo: 'md5' })]), /integrity|algorithm/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ hashAlgo: 'sha1' })]), /integrity|algorithm/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ hashAlgo: 'sha256 ' })]), /integrity|algorithm/i);
  });

  it('rejects malformed digests (wrong length, non-hex, uppercase)', async () => {
    await rejectsWithoutMutation(v5Json([validV5Entry({ sha256: 'deadbeef' })]), /integrity/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ sha256: DIGEST.slice(0, 63) })]), /integrity/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ sha256: DIGEST.toUpperCase() })]), /integrity/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ sha256: `g${DIGEST.slice(1)}` })]), /integrity/i);
  });

  it('rejects missing or non-integer byte-length metadata on v5', async () => {
    const e = validV5Entry();
    delete e.bytes;
    await rejectsWithoutMutation(v5Json([e]), /integrity/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ bytes: 1.5 })]), /integrity/i);
  });

  it('rejects byte-length metadata that disagrees with the decoded payload', async () => {
    await rejectsWithoutMutation(v5Json([validV5Entry({ bytes: BYTES.length + 1 })]), /integrity/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ bytes: BYTES.length - 1 })]), /integrity/i);
  });

  it('rejects truncated and noncanonical base64 payloads', async () => {
    await rejectsWithoutMutation(v5Json([validV5Entry({ base64: B64.slice(0, B64.length - 1) })]), /integrity|base64/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ base64: B64.slice(0, -2) })]), /integrity|base64/i);
    await rejectsWithoutMutation(v5Json([validV5Entry({ base64: `${B64} ` })]), /integrity|base64/i);
  });

  it('tampered payload bytes with correct-length metadata still fail the digest', async () => {
    const tampered = Buffer.from(BYTES);
    tampered[4] ^= 0xff;
    await rejectsWithoutMutation(
      v5Json([validV5Entry({ base64: Buffer.from(tampered).toString('base64') })]),
      /integrity/i
    );
  });

  it('v5 milestone entries satisfy the same rules', () => {
    const good = validV5Entry({
      recordId: MILESTONE.id,
      field: 'milestonePhoto',
      fileName: 'roll.jpg',
    });
    expect(planImport(v5Json([good]), emptyData(), 'replace').ok).toBe(true);
    const bad = { ...good, sha256: DIGEST.toUpperCase() };
    expect(planImport(v5Json([bad]), emptyData(), 'replace').ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Version/algorithm combinations.
// ---------------------------------------------------------------------------

describe('hash-version compatibility matrix', () => {
  it('an authentic v4 entry (legacy checksum, no hashAlgo, no bytes) still imports', () => {
    const legacy: PhotoEntry = {
      recordId: BABY.id,
      field: 'babyPhoto',
      fileName: 'profile.jpg',
      base64: B64,
      sha256: hashContent(B64),
    };
    const plan = planImport(v5Json([legacy], 4), emptyData(), 'replace');
    expect(plan.ok).toBe(true);
    expect(plan.photos).toHaveLength(1);
  });

  it('a v4 entry claiming hashAlgo sha256 is an unsupported combination (never reinterpreted)', async () => {
    const smuggled = validV5Entry(); // correct v5 metadata, but labelled v4
    await rejectsWithoutMutation(v5Json([smuggled], 4), /integrity|hash algorithm/i);
  });

  it('a v4 entry with bytes but no checksum at all is rejected as unverifiable', async () => {
    const e: PhotoEntry = {
      recordId: BABY.id,
      field: 'babyPhoto',
      fileName: 'profile.jpg',
      base64: B64,
    };
    await rejectsWithoutMutation(v5Json([e], 4), /integrity/i);
  });

  it('orphaned and duplicate manifest references remain hard errors', async () => {
    await rejectsWithoutMutation(
      v5Json([validV5Entry({ recordId: 'e0000000-0000-4000-8000-000000000009' })]),
      /record/i
    );
    await rejectsWithoutMutation(v5Json([validV5Entry(), validV5Entry()]), /duplicate/i);
  });

  it('entries without base64 remain a warning path, not an error', () => {
    const plan = planImport(v5Json([validV5Entry({ base64: undefined })]), emptyData(), 'replace');
    expect(plan.ok).toBe(true);
    expect(plan.photos).toHaveLength(1);
  });
});
