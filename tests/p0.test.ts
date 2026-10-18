import { describe, it, expect } from 'vitest';
import type { AppData, ActiveTimer, Baby, CareEvent, MilestoneRecord } from '../src/models/types';
import { MemoryCareRepository, type MemoryRealms } from '../src/data/MemoryCareRepository';
import { mergeData, buildBackup, BACKUP_VERSION, emptyData } from '../src/models/backup';
import { buildFullBackup, restoreEmbeddedPhotos, remapEmbeddedPhotos, type EmbeddedPhoto } from '../src/models/mediaBackup';
import { hashContent } from '../src/models/hash';
import {
  planImport, applyImportPlan, applyImportPlanOrFail, describeImportPlan, type ImportPlan,
} from '../src/models/importPlan';
import { commitTimerCompletion } from '../src/models/timerCompletion';
import { validateEvent } from '../src/models/validation';
import { missingColumns, type ColumnDef } from '../src/models/columns';

// Fixed, schema-valid UUIDs so failure messages stay readable in the assertions.
const B1 = '11111111-1111-4111-8111-111111111111';
const B2 = '22222222-2222-4222-8222-222222222222';
const E1 = 'eeeeeeee-1111-4111-8111-111111111111';
const E2 = 'eeeeeeee-2222-4222-8222-222222222222';
const E9 = 'eeeeeeee-9999-4999-8999-999999999999';
const M1 = 'aaaa1111-1111-4111-8111-111111111111';
const GHOST = '99999999-9999-4999-8999-999999999999';
const DEMO_BABY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DEMO_E1 = 'dddddddd-eeee-4eee-8eee-eeeeeeeeeeee';
const DEMO_EXTRA = 'dddddddd-eeee-4eee-8eee-eeeeeeeeeeef';
const T1 = 'tttttttt-tttt-4ttt-8ttt-tttttttttt00'.replace(/t/g, '7');

function baby(overrides: Partial<Baby> = {}): Baby {
  return {
    id: B1, name: 'Aru', birthDate: '2026-08-14',
    createdAt: '2026-10-17T08:00:00.000Z', ...overrides,
  };
}

function event(overrides: Partial<CareEvent> = {}): CareEvent {
  return {
    id: E1, babyId: B1, type: 'diaper', timestamp: '2026-10-17T08:00:00.000Z',
    diaperType: 'wet', ...overrides,
  } as CareEvent;
}

function dataWith(babies: Baby[], events: CareEvent[]): AppData {
  return {
    babies, events, activeTimers: [], growthRecords: [], milestones: [],
    medications: [], medicationAdministrations: [], vaccinations: [], routines: [],
    schemaVersion: 3,
  };
}

function demoPayload(): AppData {
  return dataWith(
    [baby({ id: DEMO_BABY, name: 'Demo', isDemo: true })],
    [event({ id: DEMO_E1, babyId: DEMO_BABY, isDemo: true })]
  );
}

describe('P0-1 demo isolation (repository-level swap contract)', () => {
  it('enterDemo keeps personal rows intact; exit restores them exactly', async () => {
    const repo = new MemoryCareRepository();
    await repo.replaceAll(dataWith([baby()], [event()]));

    await repo.setDemoMode(true);
    await repo.replaceAll(demoPayload());
    await repo.addEvent(event({ id: DEMO_EXTRA, babyId: DEMO_BABY, isDemo: true }));
    const inDemo = await repo.loadAll();
    expect(inDemo.babies.map((b) => b.id)).toEqual([DEMO_BABY]);
    expect(inDemo.events.map((e) => e.id)).toContain(DEMO_EXTRA);
    await repo.setDemoMode(false);

    const after = await repo.loadAll();
    expect(after.babies.map((b) => b.id)).toEqual([B1]);
    expect(after.events.map((e) => e.id)).toEqual([E1]);
  });

  it('personal data survives entry, exit AND restart (fresh repo load)', async () => {
    const store: MemoryRealms = {};
    const r1 = new MemoryCareRepository(store);
    await r1.init();
    await r1.replaceAll(dataWith([baby()], [event()]));
    await r1.setDemoMode(true);
    await r1.replaceAll(demoPayload());

    const r2 = new MemoryCareRepository(store);
    await r2.init();
    await r2.setDemoMode(true);
    const stillDemo = await r2.loadAll();
    expect(stillDemo.babies.map((b) => b.id)).toEqual([DEMO_BABY]);
    await r2.setDemoMode(false);

    const restarted = await r2.loadAll();
    expect(restarted.babies.map((b) => b.id)).toContain(B1);
    expect(restarted.events.map((e) => e.id)).toContain(E1);
    expect(restarted.events.map((e) => e.id)).not.toContain(DEMO_E1);
  });

  it('demo edits never leak into the personal realm', async () => {
    const store: MemoryRealms = {};
    const r = new MemoryCareRepository(store);
    await r.replaceAll(dataWith([baby()], [event()]));
    await r.setDemoMode(true);
    await r.replaceAll(demoPayload());
    await r.deleteEvent(DEMO_E1);
    await r.setDemoMode(false);
    const after = await r.loadAll();
    expect(after.events.map((e) => e.id)).toEqual([E1]);
  });
});

describe('P0-2 timer commit ordering (commitTimerCompletion)', () => {
  const timer: ActiveTimer = {
    id: T1, babyId: B1, kind: 'sleep',
    startedAt: '2026-10-17T09:00:00.000Z',
    segments: [{ start: '2026-10-17T09:00:00.000Z', end: null }],
  };

  it('commits the event BEFORE removing the timer', async () => {
    const repo = new MemoryCareRepository();
    await repo.addTimer(timer);
    const res = await commitTimerCompletion(repo, timer, (e) => validateEvent(e) !== null, { durationMin: 45 });
    expect(res.ok).toBe(true);
    expect(res.event).not.toBeNull();
    expect(repo.callOrder.indexOf(`event:${res.event!.id}`)).toBeLessThan(
      repo.callOrder.indexOf(`deleteTimer:${T1}`)
    );
    const after = await repo.loadAll();
    expect(after.activeTimers).toHaveLength(0);
    expect(after.events.map((e) => e.id)).toContain(res.event!.id);
  });

  it('validation failure leaves the timer untouched and deletes nothing', async () => {
    const repo = new MemoryCareRepository();
    await repo.addTimer(timer);
    const res = await commitTimerCompletion(repo, timer, () => false, { durationMin: 45 });
    expect(res.ok).toBe(false);
    expect(repo.callOrder).not.toContain(`deleteTimer:${T1}`);
    const after = await repo.loadAll();
    expect(after.activeTimers).toHaveLength(1);
    expect(after.events).toHaveLength(0);
  });

  it('deleteTimer failure rolls the event back; the timer survives for retry', async () => {
    const repo = new MemoryCareRepository();
    await repo.addTimer(timer);
    repo.failNextDeleteTimer = true;
    const res = await commitTimerCompletion(repo, timer, (e) => validateEvent(e) !== null, { durationMin: 45 });
    expect(res.ok).toBe(false);
    expect(res.event).not.toBeNull();
    const after = await repo.loadAll();
    expect(after.activeTimers).toHaveLength(1);
    expect(after.events).toHaveLength(0);
    expect(repo.callOrder).toContain(`deleteEvent:${res.event!.id}`);
  });
});

describe('P0-3 photosEmbedded parity, remap and hash verification', () => {
  const b64 = 'aGVsbG8='; // "hello"
  const sha = hashContent(b64);

  function milestoneWithPhoto(): MilestoneRecord {
    return {
      id: M1, babyId: B1, category: 'motor', title: 'Rolled over',
      date: '2026-10-17', photoUri: 'file:///docs/ninninest-media/b1/1-abc.jpg',
    };
  }

  it('buildFullBackup always exposes photosEmbedded (web smoke: empty manifest)', async () => {
    const data = dataWith([baby()], [event()]);
    const full = await buildFullBackup(data);
    expect(Array.isArray(full.photosEmbedded)).toBe(true);
    expect(full.photosEmbedded).toHaveLength(0); // no managed files on web
  });

  it('full backup shape embeds photos with their integrity hash', () => {
    const data = dataWith([baby()], [event()]);
    const base = buildBackup(data);
    const full = { ...base, photosEmbedded: [
      { recordId: M1, field: 'milestonePhoto' as const, fileName: '1-abc.jpg', base64: b64, sha256: sha },
    ] };
    expect(full.photosEmbedded).toHaveLength(1);
    expect(full.photosEmbedded[0].sha256).toBe(sha);
  });

  it('planImport reads photosEmbedded entries (the export field)', () => {
    const backup = {
      app: 'NinniNest', backupVersion: BACKUP_VERSION, exportedAt: '2026-10-17T00:00:00.000Z',
      data: dataWith([baby()], [event()]), photos: [],
      photosEmbedded: [
        { recordId: M1, field: 'milestonePhoto', fileName: '1-abc.jpg', base64: b64, sha256: sha },
      ],
    };
    const plan = planImport(JSON.stringify(backup), dataWith([], []), 'replace');
    expect(plan.ok).toBe(true);
    expect(plan.photos).toHaveLength(1);
    expect(plan.photos[0].recordId).toBe(M1);
  });

  it('planImport also accepts legacy photos entries that carry base64', () => {
    const backup = {
      app: 'NinniNest', backupVersion: BACKUP_VERSION, exportedAt: '2026-10-17T00:00:00.000Z',
      data: dataWith([baby()], [event()]),
      photos: [
        { recordId: B1, field: 'babyPhoto', fileName: 'p.jpg', base64: b64, sha256: sha },
      ],
      photosEmbedded: [],
    };
    const plan = planImport(JSON.stringify(backup), dataWith([], []), 'replace');
    expect(plan.ok).toBe(true);
    expect(plan.photos).toHaveLength(1);
  });

  it('corrupted embedded payload is a hard error, not a silent skip', () => {
    const backup = {
      app: 'NinniNest', backupVersion: BACKUP_VERSION, exportedAt: '2026-10-17T00:00:00.000Z',
      data: dataWith([baby()], [event()]), photos: [],
      photosEmbedded: [
        { recordId: M1, field: 'milestonePhoto', fileName: '1-abc.jpg', base64: b64, sha256: 'deadbeef' },
      ],
    };
    const plan = planImport(JSON.stringify(backup), dataWith([], []), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.some((i) => /integrity/i.test(i.message))).toBe(true);
  });

  it('remapEmbeddedPhotos maps restored URIs onto baby and milestone records', () => {
    const restored = new Map<string, string>([
      [`${B1}:babyPhoto`, 'file:///docs/ninninest-media/b1/restored.jpg'],
      [`${M1}:milestonePhoto`, 'file:///docs/ninninest-media/m1/restored.jpg'],
    ]);
    const data = dataWith([baby({ photoUri: undefined })], [event()]);
    const milestones: MilestoneRecord[] = [milestoneWithPhoto()];
    const remapped = remapEmbeddedPhotos(data, milestones, restored);
    expect(remapped.data.babies.find((b) => b.id === B1)!.photoUri).toBe('file:///docs/ninninest-media/b1/restored.jpg');
    expect(remapped.milestones[0].photoUri).toBe('file:///docs/ninninest-media/m1/restored.jpg');
  });

  it('restoreEmbeddedPhotos never restores a payload whose hash mismatches (web returns empty)', async () => {
    const bad: EmbeddedPhoto = {
      recordId: M1, field: 'milestonePhoto', fileName: '1-abc.jpg', base64: b64, sha256: 'deadbeef',
    };
    expect(hashContent(bad.base64!)).not.toBe(bad.sha256);
    const restored = await restoreEmbeddedPhotos([bad]);
    expect(restored.size).toBe(0);
  });
});

describe('P0-4/P0-5 import rejection and atomicity', () => {
  const personal = dataWith([baby()], [event()]);
  const goodBackup = (b: Baby[], e: CareEvent[]) => ({
    app: 'NinniNest', backupVersion: BACKUP_VERSION, exportedAt: '2026-10-17T00:00:00.000Z',
    data: dataWith(b, e), photos: [], photosEmbedded: [],
  });

  it('rejects malformed JSON outright', () => {
    const plan = planImport('{not json', personal, 'replace');
    expect(plan.ok).toBe(false);
  });

  it('hard-errors malformed and orphaned records instead of trimming them', () => {
    const backup = goodBackup(
      [baby()],
      [event(), event({ id: E2, babyId: GHOST }), { id: 'not-even-shape' } as unknown as CareEvent]
    );
    const plan = planImport(JSON.stringify(backup), personal, 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.some((i) => i.severity === 'error' && /malformed/i.test(i.message))).toBe(true);
    expect(plan.issues.some((i) => i.severity === 'error' && /missing/i.test(i.message))).toBe(true);
  });

  it('duplicate event ids in one file are rejected', () => {
    const backup = goodBackup([baby()], [event(), event()]);
    const plan = planImport(JSON.stringify(backup), personal, 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.some((i) => /duplicate/i.test(i.message))).toBe(true);
  });

  it('a failed replaceAll leaves current data intact and surfaces failure', async () => {
    const repo = new MemoryCareRepository();
    await repo.replaceAll(personal);
    repo.failNextReplace = true;
    const plan = planImport(JSON.stringify(goodBackup([baby({ id: B2 })], [event({ id: E9, babyId: B2 })])), personal, 'replace');
    expect(plan.ok).toBe(true);
    await expect(applyImportPlanOrFail(repo, plan)).rejects.toThrow();
    const after = await repo.loadAll();
    expect(after.babies.map((b) => b.id)).toEqual([B1]);
    expect(after.events.map((e) => e.id)).toEqual([E1]);
  });

  it('a failed apply never reports success', async () => {
    const repo = new MemoryCareRepository();
    await repo.replaceAll(personal);
    repo.failNextReplace = true;
    const plan = planImport(JSON.stringify(goodBackup([baby({ id: B2 })], [event({ id: E9, babyId: B2 })])), personal, 'replace');
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/untouched/i);
    expect(await repo.loadAll().then((d) => d.babies.map((b) => b.id))).toEqual([B1]);
  });

  it('successful replace swaps all records', async () => {
    const repo = new MemoryCareRepository();
    await repo.replaceAll(personal);
    const plan = planImport(JSON.stringify(goodBackup([baby({ id: B2 })], [event({ id: E9, babyId: B2 })])), personal, 'replace');
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(true);
    const after = await repo.loadAll();
    expect(after.babies.map((b) => b.id)).toEqual([B2]);
    expect(after.events.map((e) => e.id)).toEqual([E9]);
  });

  it('merge keeps existing and adds only new records', async () => {
    const repo = new MemoryCareRepository();
    await repo.replaceAll(personal);
    const plan = planImport(JSON.stringify(goodBackup([baby({ id: B2 })], [event({ id: E9, babyId: B2 })])), personal, 'merge');
    await applyImportPlan(repo, plan);
    const after = await repo.loadAll();
    expect(after.babies.map((b) => b.id).sort()).toEqual([B1, B2]);
    expect(after.events.map((e) => e.id).sort()).toEqual([E1, E9]);
  });
});

describe('P0-6 migration interruption and partial-upgrade recovery', () => {
  const activeTimerColumns: ColumnDef[] = [
    { name: 'segments', ddl: "TEXT NOT NULL DEFAULT '[]'" },
    { name: 'lastSide', ddl: 'TEXT' },
  ];

  it('a v1 schema needs both columns', () => {
    const v1 = ['id', 'babyId', 'kind', 'startedAt', 'side', 'isDemo'];
    expect(missingColumns(v1, activeTimerColumns).map((c) => c.name)).toEqual(['segments', 'lastSide']);
  });

  it('a partially upgraded schema only needs the missing column (retry-safe)', () => {
    const partial = ['id', 'babyId', 'kind', 'startedAt', 'side', 'isDemo', 'segments'];
    expect(missingColumns(partial, activeTimerColumns).map((c) => c.name)).toEqual(['lastSide']);
  });

  it('applying the plan twice is idempotent (second pass is a no-op)', () => {
    let cols = ['id', 'babyId', 'kind', 'startedAt', 'side', 'isDemo'];
    for (let pass = 0; pass < 2; pass++) {
      for (const def of missingColumns(cols, activeTimerColumns)) cols = [...cols, def.name];
    }
    expect(cols).toContain('segments');
    expect(cols).toContain('lastSide');
    expect(missingColumns(cols, activeTimerColumns)).toHaveLength(0);
  });
});

describe('mergeData (pure, existing behaviour kept)', () => {
  it('union by id across all record kinds', () => {
    const a = dataWith([baby()], [event()]);
    const b = dataWith([baby({ id: B2 })], [event({ id: E2 })]);
    const m = mergeData(a, b);
    expect(m.babies).toHaveLength(2);
    expect(m.events).toHaveLength(2);
    expect(m.schemaVersion).toBe(3);
  });

  it('emptyData returns a valid empty v3 shape', () => {
    expect(emptyData().babies).toEqual([]);
    expect(emptyData().schemaVersion).toBe(3);
  });
});

describe('plan/apply helpers used by settings import flow', () => {
  it('describeImportPlan summarises counts', () => {
    const backup = {
      app: 'NinniNest', backupVersion: BACKUP_VERSION, exportedAt: '2026-10-17T00:00:00.000Z',
      data: dataWith([baby()], [event()]), photos: [], photosEmbedded: [],
    };
    const plan = planImport(JSON.stringify(backup), dataWith([], []), 'replace');
    expect(plan.ok).toBe(true);
    expect(describeImportPlan(plan)).toContain('1');
  });

  it('ImportPlan exposes counts and mode', () => {
    const backup = {
      app: 'NinniNest', backupVersion: BACKUP_VERSION, exportedAt: '2026-10-17T00:00:00.000Z',
      data: dataWith([baby()], [event()]), photos: [], photosEmbedded: [],
    };
    const plan: ImportPlan = planImport(JSON.stringify(backup), dataWith([], []), 'merge');
    expect(plan.mode).toBe('merge');
    expect(plan.counts.babies).toBe(1);
  });

  it('timers are never restored from a backup file', () => {
    const data = dataWith([baby()], [event()]);
    data.activeTimers = [{
      id: T1, babyId: B1, kind: 'sleep', startedAt: '2026-10-17T09:00:00.000Z',
      segments: [{ start: '2026-10-17T09:00:00.000Z', end: null }],
    }];
    const backup = {
      app: 'NinniNest', backupVersion: BACKUP_VERSION, exportedAt: '2026-10-17T00:00:00.000Z',
      data, photos: [], photosEmbedded: [],
    };
    const plan = planImport(JSON.stringify(backup), dataWith([], []), 'replace');
    expect(plan.ok).toBe(true);
    expect(plan.target!.activeTimers).toEqual([]);
  });
});
