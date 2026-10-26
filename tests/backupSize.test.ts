import { describe, it, expect } from 'vitest';
import { buildFullBackupWithReport } from '../src/models/mediaBackup';
import { buildBackup, emptyData } from '../src/models/backup';
import { base64ToBytes, sha256Hex } from '../src/models/hash';
import type { AppData, Baby } from '../src/models/types';

/**
 * Measures full-backup (records + embedded photos) size scaling with 0, 1,
 * 20 and 100 synthetic photos. Documents the memory/file-size envelope the
 * known-limitations file flagged as unmeasured. Loose assertions only — the
 * measured numbers are recorded in RELEASE_EVIDENCE.md.
 */

const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};

// ~192 KB of pseudo-random bytes per photo (base64 ≈ 256 KB of text).
function photoBytes(seed: number): Uint8Array {
  const bytes = new Uint8Array(192 * 1024);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + seed * 7) % 256;
  return bytes;
}

function dataWithBabies(count: number): AppData {
  const babies = Array.from({ length: count }, (_, i) => ({
    ...BABY,
    id: `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    name: `Baby ${i}`,
    photoUri: undefined,
  }));
  return { ...emptyData(), babies };
}

describe('full backup size envelope (records + embedded media)', () => {
  const cases = [0, 1, 20, 100];
  const observed: string[] = [];

  it.each(cases)('measures a backup with %i photos (~192 KB raw each)', async (n) => {
    const { Directory, Paths } = await import('expo-file-system');
    const managedRoot = new Directory(Paths.document, 'ninninest-media').uri;
    const data = dataWithBabies(2);
    const photoPayloads = Array.from({ length: n }, (_, i) => {
      const bytes = photoBytes(i);
      const binary = Buffer.from(bytes).toString('base64');
      return { bytes, b64: binary };
    });
    // one baby per photo: the data model carries a single photoUri per baby
    const withPhotos: AppData = {
      ...dataWithBabies(Math.max(n, 2)),
      babies: Array.from({ length: Math.max(n, 2) }, (_, i) => ({
        ...BABY,
        id: `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        name: `Baby ${i}`,
        ...(i < n ? { photoUri: `${managedRoot}/p${i}.jpg` } : {}),
      })),
    };
    const { backup } = await buildFullBackupWithReport(withPhotos, undefined, {
      readFileBase64: async (uri) => {
        const idx = Number(/p(\d+)\.jpg$/.exec(uri)?.[1] ?? 0);
        return photoPayloads[idx % photoPayloads.length].b64;
      },
    });
    const json = JSON.stringify(backup);
    const mb = json.length / (1024 * 1024);
    observed.push(`${n} photos → ${mb.toFixed(2)} MB JSON`);
    // sanity: every embedded entry verifies against its own digest
    for (const p of backup.photosEmbedded) {
      expect(sha256Hex(base64ToBytes(p.base64!))).toBe(p.sha256);
    }
    // scaling stays linear-ish: 100 photos must not blow past 40 MB of JSON
    expect(mb).toBeLessThan(40);
  }, 30000);

  it('records-only backup stays tiny regardless of media', () => {
    const json = JSON.stringify(buildBackup(dataWithBabies(50)));
    expect(json.length).toBeLessThan(200 * 1024);
  });

  it.afterAll(() => {
    // eslint-disable-next-line no-console
    console.log('BACKUP SIZE ENVELOPE:\n' + observed.join('\n'));
  });
});
