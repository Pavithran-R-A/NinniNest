import { describe, it, expect, vi } from 'vitest';
import { planImport, applyImportPlan, runBackupImport } from '../src/models/importPlan';
import { buildBackup, BACKUP_VERSION, emptyData } from '../src/models/backup';
import { hashContent } from '../src/models/hash';
import { MemoryCareRepository } from '../src/data/MemoryCareRepository';
import type { AppData, Baby, CareEvent } from '../src/models/types';

const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};

function currentData(): AppData {
  return {
    ...emptyData(),
    babies: [BABY],
    events: [
      { id: 'b0000000-0000-4000-8000-0000000000aa', babyId: BABY.id, type: 'diaper', timestamp: '2026-10-15T09:00:00.000Z', diaperType: 'wet' },
    ] as unknown as CareEvent[],
  };
}

function incomingData(): AppData {
  return {
    ...emptyData(),
    babies: [BABY],
    events: [
      { id: 'b0000000-0000-4000-8000-000000000001', babyId: BABY.id, type: 'feed_bottle', timestamp: '2026-10-15T10:00:00.000Z', amountMl: 60, milkType: 'formula' },
    ] as unknown as CareEvent[],
  };
}

function backupJson(overrides: Record<string, unknown> = {}, data: AppData = incomingData()): string {
  return JSON.stringify({ ...buildBackup(data), ...overrides });
}

function snapshot(repo: MemoryCareRepository): string {
  return JSON.stringify(repo.data);
}

describe('Stage 1 import safety: malformed imports never modify existing records', () => {
  it('valid import plans accept and apply through the repository', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const plan = planImport(backupJson(), currentData(), 'replace');
    expect(plan.ok).toBe(true);
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(true);
    expect(repo.data.babies).toHaveLength(1);
    expect(repo.data.events.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects a newer backup version and leaves records untouched', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const before = snapshot(repo);
    const plan = planImport(backupJson({ backupVersion: BACKUP_VERSION + 1 }), currentData(), 'replace');
    expect(plan.ok).toBe(false);
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(false);
    expect(snapshot(repo)).toBe(before);
  });

  it('rejects malformed records and leaves records untouched', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const before = snapshot(repo);
    const raw = JSON.parse(backupJson()) as { data: Record<string, unknown[]> };
    raw.data.babies = [{ id: 'not-a-valid-baby' }];
    const plan = planImport(JSON.stringify(raw), currentData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.some((i) => i.severity === 'error')).toBe(true);
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(false);
    expect(snapshot(repo)).toBe(before);
  });

  it('rejects duplicate event ids inside the file and leaves records untouched', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const before = snapshot(repo);
    const data = currentData();
    const dup = JSON.parse(JSON.stringify(data.events[0])) as CareEvent;
    (data.events as CareEvent[]).push(dup);
    const plan = planImport(backupJson({}, data), currentData(), 'merge');
    expect(plan.ok).toBe(false);
    expect(plan.issues.map((i) => i.message).join(' ')).toContain('duplicate event id');
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(false);
    expect(snapshot(repo)).toBe(before);
  });

  it('rejects orphaned events (baby missing from file and device) and leaves records untouched', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const before = snapshot(repo);
    const data = currentData();
    data.babies = []; // event still references the missing baby
    const plan = planImport(backupJson({}, data), currentData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.map((i) => i.message).join(' ')).toContain('reference a profile');
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(false);
    expect(snapshot(repo)).toBe(before);
  });

  it('rejects a corrupted embedded photo (hash mismatch) and leaves records untouched', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const before = snapshot(repo);
    const payload = 'aGVsbG8gcGhvdG8=';
    const tampered = 'aGVsbG8gcGhvdE0=';
    const plan = planImport(
      backupJson({
        photosEmbedded: [
          { recordId: BABY.id, field: 'babyPhoto', fileName: 'profile.jpg', base64: tampered, sha256: hashContent(payload) },
        ],
      }),
      currentData(),
      'replace'
    );
    expect(plan.ok).toBe(false);
    expect(plan.issues.map((i) => i.message).join(' ')).toContain('integrity check');
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(false);
    expect(snapshot(repo)).toBe(before);
  });

  it('a mid-write replaceAll failure leaves existing records intact', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const before = snapshot(repo);
    const plan = planImport(backupJson(), currentData(), 'replace');
    expect(plan.ok).toBe(true);
    repo.failNextReplace = true;
    const result = await applyImportPlan(repo, plan);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('failed while writing');
    expect(snapshot(repo)).toBe(before);
  });

  it('a rejected database write never invokes media restoration', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const plan = planImport(backupJson(), currentData(), 'replace');
    expect(plan.ok).toBe(true);
    const restorePhotos = vi.fn(async () => new Map<string, string>());
    const refresh = vi.fn(async () => {});
    repo.failNextReplace = true;
    const message = await runBackupImport(repo, plan, { restorePhotos, refresh });
    expect(message).toContain('failed while writing');
    expect(restorePhotos).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('replace mode erases pre-existing records only on success', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const plan = planImport(backupJson(), currentData(), 'replace');
    await applyImportPlan(repo, plan);
    // incoming backup has exactly the fixture's one event, not the seeded 'aa' event
    expect(repo.data.events.some((e) => e.id === 'b0000000-0000-4000-8000-0000000000aa')).toBe(false);
  });

  it('merge mode keeps existing records and adds only new ids', async () => {
    const repo = new MemoryCareRepository();
    await repo.init();
    const plan = planImport(backupJson(), currentData(), 'merge');
    await applyImportPlan(repo, plan);
    expect(repo.data.events.some((e) => e.id === 'b0000000-0000-4000-8000-0000000000aa')).toBe(true);
    expect(repo.data.events.some((e) => e.id === 'b0000000-0000-4000-8000-000000000001')).toBe(true);
    expect(repo.data.events).toHaveLength(2); // seeded event kept, backup event added
    expect(repo.data.babies).toHaveLength(1);
  });
});
