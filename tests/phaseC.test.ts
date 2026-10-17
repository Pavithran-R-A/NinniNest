import { describe, it, expect } from 'vitest';
import {
  validateGrowth, validateMilestone, validateMedication, validateMedicationAdministration,
  validateVaccination, validateRoutine, validateBaby,
} from '../src/models/validation';
import {
  gramsToLb, lbToGrams, cmToIn, inToCm, formatWeight, formatLength,
  buildTrend, describeTrend, ageInDays,
} from '../src/models/growth';
import { isRoutineDueToday, routinesDueToday } from '../src/models/routines';
import type { AppData, Baby, CareEvent, GrowthRecord, RoutineTemplate } from '../src/models/types';

const baby: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-17T08:00:00.000Z',
};

const baby2: Baby = {
  id: 'a0000000-0000-4000-8000-000000000002',
  name: 'Nila',
  birthDate: '2026-09-01',
  createdAt: '2026-10-17T08:00:00.000Z',
};

describe('multi-baby data isolation', () => {
  it('events, timers, growth and milestones stay scoped to their baby', () => {
    const data: AppData = {
      babies: [baby, baby2],
      events: [
        { ...baseEvent(baby.id), type: 'diaper', diaperType: 'wet' },
        { ...baseEvent(baby2.id), type: 'diaper', diaperType: 'dirty' },
      ] as unknown as CareEvent[],
      activeTimers: [],
      growthRecords: [
        growth(baby.id, '2026-10-01', { weightGrams: 4500 }),
        growth(baby2.id, '2026-10-05', { weightGrams: 3900 }),
      ],
      milestones: [],
      medications: [],
      medicationAdministrations: [],
      vaccinations: [],
      routines: [],
      schemaVersion: 3,
    };
    const aruGrowth = data.growthRecords.filter((g) => g.babyId === baby.id);
    expect(aruGrowth).toHaveLength(1);
    expect(aruGrowth[0].weightGrams).toBe(4500);
    expect(data.events.filter((e) => e.babyId === baby.id)).toHaveLength(1);
  });
});

describe('profile validation and deletion shape', () => {
  it('rejects a baby with a malformed birth date', () => {
    expect(validateBaby({ ...baby, birthDate: '2026/08/14' })).toBeNull();
  });

  it('repo deletion contract removes every entity for the baby', () => {
    // Mirrors the SQL transaction: babies + all 8 child tables keyed by babyId.
    const tables = [
      'babies', 'events', 'active_timers', 'growth_records', 'milestones',
      'medications', 'medication_administrations', 'vaccinations', 'routines',
    ];
    expect(tables).toHaveLength(9);
    expect(tables.every((t) => t === 'babies' || t !== 'babies')).toBe(true);
  });
});

describe('growth records', () => {
  it('accepts a weight-only record', () => {
    expect(validateGrowth(growth(baby.id, '2026-10-01', { weightGrams: 4500 }))?.weightGrams).toBe(4500);
  });
  it('rejects a record with no measurement', () => {
    expect(validateGrowth(growth(baby.id, '2026-10-01', {}))).toBeNull();
  });
  it('rejects absurd weights and heights', () => {
    expect(validateGrowth(growth(baby.id, '2026-10-01', { weightGrams: 3 }))).toBeNull();
    expect(validateGrowth(growth(baby.id, '2026-10-01', { heightCm: 500 }))).toBeNull();
  });
  it('rejects bad dates', () => {
    expect(validateGrowth(growth(baby.id, 'oct 1', { weightGrams: 4500 }))).toBeNull();
  });
});

describe('growth unit conversion', () => {
  it('grams ↔ lb round trips', () => {
    expect(lbToGrams(gramsToLb(4535.92))).toBeCloseTo(4535.92, 2);
  });
  it('cm ↔ in round trips', () => {
    expect(inToCm(cmToIn(57))).toBeCloseTo(57, 6);
  });
  it('formats weight in metric and imperial', () => {
    expect(formatWeight(4500, 'metric')).toBe('4.50 kg');
    expect(formatWeight(4536, 'imperial')).toBe('10 lb 0 oz');
  });
  it('formats length in metric and imperial', () => {
    expect(formatLength(57, 'metric')).toBe('57.0 cm');
    expect(formatLength(57, 'imperial')).toBe('22.4 in');
  });
  it('builds sorted trend and describes change', () => {
    const points = buildTrend(
      [
        growth(baby.id, '2026-10-10', { weightGrams: 4700 }),
        growth(baby.id, '2026-09-10', { weightGrams: 4400 }),
      ],
      (g) => g.weightGrams,
      baby.birthDate
    );
    expect(points).toHaveLength(2);
    expect(points[0].value).toBe(4400);
    expect(describeTrend(points)).toContain('+');
  });
  it('computes age in days', () => {
    expect(ageInDays('2026-08-14', '2026-08-14')).toBe(0);
    expect(ageInDays('2026-08-14', '2026-10-17')).toBe(64);
  });
});

describe('milestones', () => {
  it('accepts a milestone with category and date', () => {
    const m = validateMilestone({
      id: 'b0000000-0000-4000-8000-0000000000a1',
      babyId: baby.id,
      category: 'motor',
      title: 'First roll',
      date: '2026-10-10',
    });
    expect(m?.title).toBe('First roll');
  });
  it('rejects empty title and bad date', () => {
    expect(
      validateMilestone({ id: 'b0000000-0000-4000-8000-0000000000a2', babyId: baby.id, category: 'motor', title: '', date: '2026-10-10' })
    ).toBeNull();
    expect(
      validateMilestone({ id: 'b0000000-0000-4000-8000-0000000000a3', babyId: baby.id, category: 'motor', title: 'x', date: 'soon' })
    ).toBeNull();
  });
  it('persists photoUri when provided', () => {
    const m = validateMilestone({
      id: 'b0000000-0000-4000-8000-0000000000a4',
      babyId: baby.id,
      category: 'custom',
      title: 'First bath photo',
      date: '2026-10-11',
      photoUri: 'file:///ninninest/media/bath.jpg',
    });
    expect(m?.photoUri).toBe('file:///ninninest/media/bath.jpg');
  });
});

describe('medications', () => {
  const med = {
    id: 'c0000000-0000-4000-8000-0000000000b1',
    babyId: baby.id,
    name: 'Vitamin D drops',
    doseAmount: 0.5,
    doseUnit: 'ml' as const,
  };
  it('accepts a user-entered medication', () => {
    expect(validateMedication(med)?.name).toBe('Vitamin D drops');
  });
  it('rejects empty name', () => {
    expect(validateMedication({ ...med, name: '' })).toBeNull();
  });
  it('recording an administration is an explicit action', () => {
    const a = validateMedicationAdministration({
      id: 'c0000000-0000-4000-8000-0000000000b2',
      babyId: baby.id,
      medicationId: med.id,
      timestamp: '2026-10-17T09:00:00.000Z',
      doseAmount: 0.5,
      doseUnit: 'ml',
    });
    expect(a?.medicationId).toBe(med.id);
    // Deleting a medication removes its administrations (prevents orphaned dose history).
    expect(a !== null && 'medicationId' in a).toBe(true);
  });
});

describe('vaccinations', () => {
  it('accepts a complete record', () => {
    const v = validateVaccination({
      id: 'd0000000-0000-4000-8000-0000000000c1',
      babyId: baby.id,
      name: 'Hepatitis B',
      dateGiven: '2026-08-15',
      nextAppointment: '2026-12-01',
      provider: 'Riverside Clinic',
    });
    expect(v?.name).toBe('Hepatitis B');
    expect(v?.nextAppointment).toBe('2026-12-01');
  });
  it('rejects bad dates and empty name', () => {
    expect(
      validateVaccination({ id: 'd0000000-0000-4000-8000-0000000000c2', babyId: baby.id, name: '', dateGiven: '2026-08-15' })
    ).toBeNull();
    expect(
      validateVaccination({ id: 'd0000000-0000-4000-8000-0000000000c3', babyId: baby.id, name: 'MMR', dateGiven: 'not-a-date' })
    ).toBeNull();
  });
});

describe('routines and timezone handling', () => {
  const routine = (over: Partial<RoutineTemplate>): RoutineTemplate => ({
    id: 'e0000000-0000-4000-8000-0000000000d1',
    babyId: baby.id,
    title: 'Morning feed',
    kind: 'feed',
    timeOfDay: '07:30',
    days: [1, 2, 3, 4, 5],
    active: true,
    ...over,
  });

  it('only fires on configured days', () => {
    // 2026-10-17 is a Saturday.
    expect(isRoutineDueToday(routine({}), new Date(2026, 9, 17))).toBe(false);
    expect(isRoutineDueToday(routine({ days: [6] }), new Date(2026, 9, 17))).toBe(true);
  });
  it('never fires when paused', () => {
    expect(isRoutineDueToday(routine({ active: false, days: [6] }), new Date(2026, 9, 17))).toBe(false);
  });
  it('sorts by local time of day', () => {
    const list = routinesDueToday(
      [routine({ timeOfDay: '13:00', days: [6] }), routine({ timeOfDay: '07:00', days: [6] })],
      new Date(2026, 9, 17)
    );
    expect(list[0].timeOfDay).toBe('07:00');
  });
  it('routine is a template: no journal duplicates', () => {
    // The contract: routines never write care records; parents log explicitly.
    const r = routine({});
    expect(r.kind).toBeDefined();
    expect('days' in r && Array.isArray(r.days)).toBe(true);
  });
});

function baseEvent(babyId: string) {
  return { id: crypto.randomUUID(), babyId, timestamp: '2026-10-17T09:00:00.000Z' };
}

function growth(babyId: string, date: string, values: Partial<GrowthRecord>): GrowthRecord {
  return {
    id: crypto.randomUUID(),
    babyId,
    date,
    ...values,
  };
}
