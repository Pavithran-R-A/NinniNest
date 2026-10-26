import { describe, it, expect } from 'vitest';
import { planImport, IMPORT_LIMITS } from '../src/models/importPlan';
import { buildBackup, emptyData, BACKUP_VERSION } from '../src/models/backup';
import type { AppData, Baby, CareEvent } from '../src/models/types';

const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};
const ev = (i: number): CareEvent =>
  ({ id: `b0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, babyId: BABY.id, type: 'diaper', timestamp: '2026-10-15T09:00:00.000Z', diaperType: 'wet' }) as unknown as CareEvent;

function backupWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...buildBackup({ ...emptyData(), babies: [BABY] }), ...overrides });
}

describe('import bounds (untrusted-input hardening)', () => {
  it('accepts a normal-sized backup untouched by the limits', () => {
    const plan = planImport(backupWith({ data: { ...emptyData(), babies: [BABY], events: Array.from({ length: 1000 }, (_, i) => ev(i)) } }), emptyData(), 'replace');
    expect(plan.ok).toBe(true);
  });

  it('rejects an oversized EVENTS collection before validation runs', () => {
    const over = Array.from({ length: IMPORT_LIMITS.maxPerCollection.events + 1 }, (_, i) => ev(i));
    const plan = planImport(backupWith({ data: { ...emptyData(), babies: [BABY], events: over } }), emptyData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.some((i) => /exceeds what one journal can hold/.test(i.message))).toBe(true);
  });

  it('rejects oversized embedded photo counts', () => {
    const photos = Array.from({ length: IMPORT_LIMITS.maxEmbeddedPhotos + 1 }, (_, i) => ({
      recordId: BABY.id, field: 'babyPhoto' as const, fileName: `p${i}.jpg`, base64: undefined,
    }));
    const plan = planImport(backupWith({ photosEmbedded: photos }), emptyData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.some((i) => /exceeds what one journal can hold/.test(i.message))).toBe(true);
  });

  it('rejects a JSON payload beyond the absolute size cap without parsing it', () => {
    const huge = 'x'.repeat(IMPORT_LIMITS.maxJsonChars + 1);
    const plan = planImport(huge, emptyData(), 'replace');
    expect(plan.ok).toBe(false);
    expect(plan.issues.some((i) => /far larger than any backup/.test(i.message))).toBe(true);
  });

  it('the current backup version is still accepted (limits do not break real files)', () => {
    const plan = planImport(backupWith({ backupVersion: BACKUP_VERSION }), emptyData(), 'replace');
    expect(plan.ok).toBe(true);
  });
});
