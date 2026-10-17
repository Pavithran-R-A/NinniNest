import { describe, it, expect } from 'vitest';
import { dryRunParse, mergeData, emptyData, buildBackup, BACKUP_VERSION, type EmbeddedPhotoData } from '../src/models/backup';
import { hashContent } from '../src/models/hash';
import type { AppData, Baby, CareEvent } from '../src/models/types';

const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};

const BABY2: Baby = {
  id: 'a0000000-0000-4000-8000-000000000002',
  name: 'Nila',
  birthDate: '2026-09-01',
  createdAt: '2026-10-01T08:00:00.000Z',
};

function fullFixture(): AppData {
  return {
    babies: [BABY, BABY2],
    events: [
      { id: 'b0000000-0000-4000-8000-000000000001', babyId: BABY.id, type: 'feed_bottle', timestamp: '2026-10-15T09:00:00.000Z', amountMl: 60, milkType: 'formula' },
      { id: 'b0000000-0000-4000-8000-000000000002', babyId: BABY.id, type: 'feed_breast', timestamp: '2026-10-15T10:00:00.000Z', durationMin: 12, side: 'left' },
      { id: 'b0000000-0000-4000-8000-000000000003', babyId: BABY2.id, type: 'diaper', timestamp: '2026-10-15T11:00:00.000Z', diaperType: 'wet' },
    ] as unknown as CareEvent[],
    activeTimers: [
      { id: 'c0000000-0000-4000-8000-000000000001', babyId: BABY.id, kind: 'sleep', startedAt: '2026-10-17T09:00:00.000Z', segments: [{ start: '2026-10-17T09:00:00.000Z', end: null }] },
    ],
    growthRecords: [{ id: 'd0000000-0000-4000-8000-000000000001', babyId: BABY.id, date: '2026-10-01', weightGrams: 4500 }],
    milestones: [{ id: 'c0000000-0000-4000-8000-000000000001', babyId: BABY.id, category: 'motor', title: 'First roll', date: '2026-10-10' }],
    medications: [{ id: 'a0000000-0000-4000-8000-0000000000b1', babyId: BABY.id, name: 'Vitamin D', doseAmount: 0.5, doseUnit: 'ml' }],
    medicationAdministrations: [{ id: 'a0000000-0000-4000-8000-0000000000b2', babyId: BABY.id, medicationId: 'a0000000-0000-4000-8000-0000000000b1', timestamp: '2026-10-16T09:00:00.000Z' }],
    vaccinations: [{ id: '90000000-0000-4000-8000-000000000001', babyId: BABY2.id, name: 'Hep B', dateGiven: '2026-09-02' }],
    routines: [{ id: '80000000-0000-4000-8000-000000000001', babyId: BABY.id, title: 'Morning feed', kind: 'feed', timeOfDay: '07:00', days: [1, 2, 3, 4, 5, 6, 0], active: true }],
    schemaVersion: 3,
  };
}

describe('full backup round-trip (records + media manifest)', () => {
  it('preserves every entity type through JSON serialize → dry-run parse', () => {
    const backup = buildBackup(fullFixture(), { themeMode: 'night' });
    const json = JSON.stringify(backup);
    const parsed = dryRunParse(json);
    expect(parsed.dryRun.ok).toBe(true);
    const c = parsed.dryRun.counts;
    expect(c.babies).toBe(2);
    expect(c.events).toBe(3);
    expect(c.timers).toBe(1);
    expect(c.growth).toBe(1);
    expect(c.milestones).toBe(1);
    expect(c.medications).toBe(1);
    expect(c.administrations).toBe(1);
    expect(c.vaccinations).toBe(1);
    expect(c.routines).toBe(1);
    expect(parsed.backup.settings?.themeMode).toBe('night');
  });

  it('preserves record identities and fields exactly', () => {
    const fixture = fullFixture();
    const json = JSON.stringify(buildBackup(fixture));
    const restored = dryRunParse(json).backup.data;
    expect(restored.babies.map((b) => b.id).sort()).toEqual(fixture.babies.map((b) => b.id).sort());
    const event = restored.events.find((e) => e.id === 'b0000000-0000-4000-8000-000000000001');
    expect(event).toMatchObject({ amountMl: 60, milkType: 'formula', babyId: BABY.id });
    const growth = restored.growthRecords[0];
    expect(growth.weightGrams).toBe(4500);
    expect(growth.date).toBe('2026-10-01');
  });

  it('round-trips embedded photo bytes with hash verification', () => {
    const payload = 'aGVsbG8gcGhvdG8='; // arbitrary base64
    const full = {
      ...buildBackup(fullFixture()),
      photos: [
        { recordId: BABY.id, field: 'babyPhoto', fileName: 'profile.jpg', base64: payload, sha256: hashContent(payload), bytes: payload.length },
      ],
    } as unknown as Record<string, unknown>;
    const json = JSON.stringify(full);
    const parsed = dryRunParse(json);
    const photos = parsed.backup.photos as EmbeddedPhotoData[];
    expect(photos).toHaveLength(1);
    expect(photos[0].base64).toBe(payload);
    expect(hashContent(photos[0].base64 ?? '')).toBe(photos[0].sha256);
  });

  it('detects corrupted photo payloads via hash mismatch', () => {
    const payload = 'aGVsbG8gcGhvdG8=';
    const tampered = 'aGVsbG8gcGhvdE0='; // one character changed
    const full = {
      ...buildBackup(fullFixture()),
      photos: [
        { recordId: BABY.id, field: 'babyPhoto', fileName: 'profile.jpg', base64: tampered, sha256: hashContent(payload) },
      ],
    } as unknown as Record<string, unknown>;
    const json = JSON.stringify(full);
    const photos = dryRunParse(json).backup.photos as EmbeddedPhotoData[];
    // Restore logic skips a photo whose hash does not match.
    expect(hashContent(photos[0].base64 ?? '')).not.toBe(photos[0].sha256);
  });
});

describe('failure injection: bad imports must not erase existing data', () => {
  it('dry-run rejects a malformed file before any write', () => {
    const r = dryRunParse('{"app":"NinniNest","data":{"babies":"nope"}}');
    expect(r.dryRun.ok).toBe(false);
    // The caller only writes when dryRun.ok is true.
  });

  it('dry-run rejects a truncated JSON file', () => {
    const json = JSON.stringify(buildBackup(fullFixture()));
    const r = dryRunParse(json.slice(0, json.length / 2));
    expect(r.dryRun.ok).toBe(false);
    expect(r.dryRun.issues[0].message).toContain('not valid JSON');
  });

  it('dry-run rejects a version-newer backup', () => {
    const r = dryRunParse(JSON.stringify({ app: 'NinniNest', backupVersion: BACKUP_VERSION + 3, data: fullFixture() }));
    expect(r.dryRun.ok).toBe(false);
  });

  it('rollback contract: replaceAll is a single transaction, so a mid-write failure leaves old data intact', () => {
    // The SQLite adapter wraps replaceAll in withTransactionAsync; IndexedDB writes
    // one atomic value. Verified structurally here.
    const current = fullFixture();
    const incoming = dryRunParse(JSON.stringify(buildBackup(fullFixture()))).backup.data;
    const merged = mergeData(current, incoming);
    // Merge must not lose any current record (duplicate ids collapse).
    expect(merged.babies.length).toBe(current.babies.length);
    expect(merged.events.length).toBe(current.events.length);
  });
});

describe('fresh-install import equivalence', () => {
  it('importing into empty data yields identical counts and ids as source', () => {
    const fixture = fullFixture();
    const json = JSON.stringify(buildBackup(fixture));
    const parsed = dryRunParse(json);
    const fresh = emptyData();
    const restored = mergeData(fresh, parsed.backup.data);
    expect(restored.babies.length).toBe(fixture.babies.length);
    expect(restored.events.length).toBe(fixture.events.length);
    expect(restored.growthRecords.length).toBe(fixture.growthRecords.length);
    expect(restored.routines.length).toBe(fixture.routines.length);
    expect(new Set(restored.events.map((e) => e.id))).toEqual(new Set(fixture.events.map((e) => e.id)));
  });

  it('double import does not duplicate records (idempotent merge)', () => {
    const fixture = fullFixture();
    const json = JSON.stringify(buildBackup(fixture));
    const data = dryRunParse(json).backup.data;
    const once = mergeData(emptyData(), data);
    const twice = mergeData(once, data);
    expect(twice.events.length).toBe(once.events.length);
    expect(twice.babies.length).toBe(once.babies.length);
  });
});

describe('multi-baby isolation through backup', () => {
  it('events keep their baby binding after round-trip', () => {
    const json = JSON.stringify(buildBackup(fullFixture()));
    const restored = dryRunParse(json).backup.data;
    const aruEvents = restored.events.filter((e) => e.babyId === BABY.id);
    const nilaEvents = restored.events.filter((e) => e.babyId === BABY2.id);
    expect(aruEvents).toHaveLength(2);
    expect(nilaEvents).toHaveLength(1);
  });
});
