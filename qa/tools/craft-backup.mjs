// Builds a valid NinniNest v5 backup with synthetic data for device import testing.
// Usage: node craft-backup.mjs <photoPngPath> <outPath>
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [photoPath, outPath] = process.argv.slice(2);
const png = readFileSync(photoPath);
const b64 = png.toString('base64');
const sha = createHash('sha256').update(png).digest('hex'); // genuine digest of ORIGINAL bytes

const baby1 = {
  id: 'c1000000-0000-4000-8000-000000000001',
  name: 'TestCloud1',
  birthDate: '2026-07-01',
  createdAt: '2026-10-29T10:00:00.000Z',
};
const baby2 = {
  id: 'c1000000-0000-4000-8000-000000000002',
  name: 'TestCloud2',
  birthDate: '2026-07-15',
  createdAt: '2026-10-29T10:05:00.000Z',
  photoUri: 'content://original-device/cloud2.png', // foreign URI: restore must remap to the managed copy
};

const backup = {
  app: 'NinniNest',
  backupVersion: 5,
  exportedAt: '2026-10-29T10:00:00.000Z',
  data: {
    babies: [baby1, baby2],
    events: [
      { id: 'c2000000-0000-4000-8000-000000000001', babyId: baby1.id, type: 'diaper', timestamp: '2026-10-29T09:00:00.000Z', diaperType: 'dirty' },
      { id: 'c2000000-0000-4000-8000-000000000002', babyId: baby2.id, type: 'feed_bottle', timestamp: '2026-10-29T09:30:00.000Z', amountMl: 90, milkType: 'formula' },
    ],
    activeTimers: [],
    growthRecords: [
      { id: 'c3000000-0000-4000-8000-000000000001', babyId: baby1.id, date: '2026-10-20', weightGrams: 5200, heightCm: 58 },
    ],
    milestones: [
      { id: 'c4000000-0000-4000-8000-000000000001', babyId: baby2.id, category: 'social', title: 'Cloud smile', date: '2026-10-25' },
    ],
    medications: [
      { id: 'c5000000-0000-4000-8000-000000000001', babyId: baby1.id, name: 'CloudDrops', doseAmount: 0.5, doseUnit: 'ml' },
    ],
    medicationAdministrations: [
      { id: 'c6000000-0000-4000-8000-000000000001', babyId: baby1.id, medicationId: 'c5000000-0000-4000-8000-000000000001', timestamp: '2026-10-29T08:00:00.000Z', doseAmount: 0.5, doseUnit: 'ml' },
    ],
    vaccinations: [
      { id: 'c7000000-0000-4000-8000-000000000001', babyId: baby2.id, name: 'CloudHepB', dateGiven: '2026-09-15' },
    ],
    routines: [],
    schemaVersion: 3,
  },
  photos: [],
  photosEmbedded: [
    { recordId: baby2.id, field: 'babyPhoto', fileName: 'cloud2.png', base64: b64, sha256: sha, bytes: png.length, hashAlgo: 'sha256' },
  ],
  mediaComplete: true,
  missingPhotos: [],
  settings: { themeMode: 'day' },
};

writeFileSync(outPath, JSON.stringify(backup));
console.log('written', outPath, 'sha256-of-photo:', sha, 'photo-bytes:', png.length);
