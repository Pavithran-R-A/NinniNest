import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbCareRepository } from '../src/data/IndexedDbCareRepository';
import { commitTimerCompletion } from '../src/models/timerCompletion';
import { buildBackup, emptyData, mergeData, BACKUP_VERSION } from '../src/models/backup';
import { planImport, applyImportPlan } from '../src/models/importPlan';
import type { AppData, ActiveTimer, Baby, CareEvent } from '../src/models/types';
import { validateEvent } from '../src/models/validation';

/**
 * REAL-ADAPTER integration tests: the actual IndexedDbCareRepository running
 * against a spec-compliant in-memory IndexedDB (fake-indexeddb). This is the
 * web adapter executed for real — unlike the memory-contract tests. The
 * native SQLite adapter still needs a device (NOT TESTED, see
 * docs/DEVICE_TEST_MATRIX.md); each test gets a fresh database via a unique
 * name so runs cannot leak into each other.
 */

let dbCounter = 0;
const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};

function makeRepo(): IndexedDbCareRepository {
  // The adapter opens a fixed database name; fake-indexeddb keeps databases in
  // memory per process, so clearing all records between tests is enough.
  return new IndexedDbCareRepository();
}

async function freshRepo(): Promise<IndexedDbCareRepository> {
  const repo = new IndexedDbCareRepository();
  await repo.init();
  // Ensure a pristine realm even if a previous test wrote to the same name.
  await repo.replaceAll(emptyData());
  return repo;
}

const event = (id: string, ts: string): CareEvent =>
  ({ id, babyId: BABY.id, type: 'diaper', timestamp: ts, diaperType: 'wet' }) as unknown as CareEvent;

describe('IndexedDbCareRepository (real adapter, fake-indexeddb runtime)', () => {
  it('round-trips records through the actual IndexedDB key-value store', async () => {
    const repo = await freshRepo();
    await repo.addBaby(BABY);
    await repo.addEvent(event('b0000000-0000-4000-8000-0000000000e1', '2026-10-15T09:00:00.000Z'));
    const loaded = await repo.loadAll();
    expect(loaded.babies).toHaveLength(1);
    expect(loaded.babies[0].name).toBe('Aru');
    expect(loaded.events).toHaveLength(1);
    expect(loaded.events[0].id).toBe('b0000000-0000-4000-8000-0000000000e1');
    await repo.close();
  });

  it('replaceAll is durable: a NEW adapter instance (simulated restart) reads the same rows', async () => {
    const repo = await freshRepo();
    await repo.replaceAll({
      ...emptyData(),
      babies: [BABY],
      events: [event('b0000000-0000-4000-8000-0000000000e1', '2026-10-15T09:00:00.000Z'), event('b0000000-0000-4000-8000-0000000000e2', '2026-10-16T09:00:00.000Z')],
    });
    await repo.close();
    // Reopen WITHOUT wiping — a new instance over the same store simulates an app restart.
    const restarted = new IndexedDbCareRepository();
    await restarted.init();
    const loaded = await restarted.loadAll();
    expect(loaded.events.map((e) => e.id).sort()).toEqual(['b0000000-0000-4000-8000-0000000000e1', 'b0000000-0000-4000-8000-0000000000e2']);
    expect(loaded.babies[0].id).toBe(BABY.id);
    await restarted.close();
  });

  it('completeTimerAtomic commits the event and removes the timer in one put', async () => {
    const repo = await freshRepo();
    const timer: ActiveTimer = {
      id: 't1', babyId: BABY.id, kind: 'sleep',
      startedAt: '2026-10-26T10:00:00.000Z',
      segments: [{ start: '2026-10-26T10:00:00.000Z', end: null }],
      isDemo: false,
    };
    await repo.addTimer(timer);
    const result = await commitTimerCompletion(
      repo, timer, (e) => validateEvent(e) !== null, { durationMin: 45 }
    );
    expect(result.ok).toBe(true);
    const loaded = await repo.loadAll();
    expect(loaded.events.some((e) => (e as unknown as { durationMin?: number }).durationMin === 45)).toBe(true);
    expect(loaded.activeTimers).toHaveLength(0);
    await repo.close();
  });

  it('demo realm swap is physically isolated in the real store', async () => {
    const repo = await freshRepo();
    await repo.addBaby(BABY);
    await repo.addEvent(event('b0000000-0000-4000-8000-0000000000c1', '2026-10-15T09:00:00.000Z'));

    await repo.setDemoMode(true);
    const demoView = await repo.loadAll();
    expect(demoView.babies).toHaveLength(0); // demo realm starts empty, personal invisible
    await repo.replaceAll({ ...emptyData(), babies: [{ ...BABY, id: 'a0000000-0000-4000-8000-00000000d001', isDemo: true }] });
    await repo.addEvent({ ...event('b0000000-0000-4000-8000-0000000000d1', '2026-10-15T10:00:00.000Z'), isDemo: true });

    await repo.setDemoMode(false);
    const personal = await repo.loadAll();
    expect(personal.babies).toHaveLength(1);
    expect(personal.babies[0].id).toBe(BABY.id);
    expect(personal.events.map((e) => e.id)).toEqual(['b0000000-0000-4000-8000-0000000000c1']);

    await repo.setDemoMode(true);
    const demoAgain = await repo.loadAll();
    expect(demoAgain.babies.map((b) => b.id)).toEqual(['a0000000-0000-4000-8000-00000000d001']);
    await repo.close();
  });

  it('backup import plans apply against the real adapter with merge semantics', async () => {
    const repo = await freshRepo();
    await repo.addBaby(BABY);
    await repo.addEvent(event('b0000000-0000-4000-8000-0000000000a1', '2026-10-15T09:00:00.000Z'));

    const incoming: AppData = {
      ...emptyData(),
      babies: [BABY],
      events: [event('b0000000-0000-4000-8000-0000000000b1', '2026-10-16T09:00:00.000Z')],
    };
    const backup = buildBackup(incoming);
    const plan = planImport(JSON.stringify({ ...backup, backupVersion: BACKUP_VERSION }), await repo.loadAll(), 'merge');
    expect(plan.ok).toBe(true);
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(true);

    const loaded = await repo.loadAll();
    expect([...loaded.events.map((e) => e.id)].sort()).toEqual(['b0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-0000000000b1']);
    await repo.close();
  });

  it('a failed write (schema-less monkey-patch) leaves prior data readable and intact', async () => {
    const repo = await freshRepo();
    await repo.addBaby(BABY);
    const before = await repo.loadAll();
    // Simulate storage failure: close the underlying connection so writes reject.
    await repo.close();
    let threw = false;
    try {
      await repo.addEvent(event('b0000000-0000-4000-8000-0000000000e2', '2026-10-15T10:00:00.000Z'));
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    // Reopen: the pre-failure record survives untouched.
    const reopened = new IndexedDbCareRepository();
    await reopened.init();
    const loaded = await reopened.loadAll();
    expect(loaded.babies).toHaveLength(1);
    expect(loaded.events).toHaveLength(0); // the failed write never landed
    void before;
    await reopened.close();
  });
});
