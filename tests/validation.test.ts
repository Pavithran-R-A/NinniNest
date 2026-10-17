import { describe, it, expect } from 'vitest';
import {
  validateBaby, validateEvent, validateTimer,
} from '../src/models/validation';
import type { AppData, Baby, CareEvent } from '../src/models/types';

const baby: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-17T08:00:00.000Z',
};

describe('validateBaby', () => {
  it('accepts a valid baby', () => {
    expect(validateBaby(baby)?.name).toBe('Aru');
  });
  it('rejects bad uuid', () => {
    expect(validateBaby({ ...baby, id: 'nope' })).toBeNull();
  });
  it('rejects bad birth date format', () => {
    expect(validateBaby({ ...baby, birthDate: 'august 14' })).toBeNull();
  });
  it('rejects empty name', () => {
    expect(validateBaby({ ...baby, name: '' })).toBeNull();
  });
});

describe('validateEvent', () => {
  it('accepts a bottle event', () => {
    const e: CareEvent = {
      id: 'b0000000-0000-4000-8000-000000000001',
      babyId: baby.id,
      type: 'feed_bottle',
      amountMl: 120,
      milkType: 'formula',
      timestamp: '2026-10-17T09:00:00.000Z',
    };
    expect(validateEvent(e)?.type).toBe('feed_bottle');
  });
  it('rejects bottle with absurd amount', () => {
    const e = {
      id: 'b0000000-0000-4000-8000-000000000002',
      babyId: baby.id,
      type: 'feed_bottle',
      amountMl: 50000,
      milkType: 'formula',
      timestamp: '2026-10-17T09:00:00.000Z',
    };
    expect(validateEvent(e)).toBeNull();
  });
  it('rejects unknown type', () => {
    const e = {
      id: 'b0000000-0000-4000-8000-000000000003',
      babyId: baby.id,
      type: 'vaccination',
      timestamp: '2026-10-17T09:00:00.000Z',
    };
    expect(validateEvent(e as unknown as CareEvent)).toBeNull();
  });
  it('rejects invalid timestamp', () => {
    const e = {
      id: 'b0000000-0000-4000-8000-000000000004',
      babyId: baby.id,
      type: 'diaper',
      diaperType: 'wet',
      timestamp: 'not-a-date',
    };
    expect(validateEvent(e)).toBeNull();
  });
});

describe('validateTimer', () => {
  it('accepts a valid timer', () => {
    expect(
      validateTimer({
        id: 'c0000000-0000-4000-8000-000000000001',
        babyId: baby.id,
        kind: 'sleep',
        startedAt: '2026-10-17T09:00:00.000Z',
        segments: [{ start: '2026-10-17T09:00:00.000Z', end: null }],
      })
    ).not.toBeNull();
  });
  it('rejects unknown kind', () => {
    expect(
      validateTimer({
        id: 'c0000000-0000-4000-8000-000000000002',
        babyId: baby.id,
        kind: 'solids',
        startedAt: '2026-10-17T09:00:00.000Z',
      })
    ).toBeNull();
  });
});

describe('demo isolation', () => {
  it('demo data never mixes with personal events', () => {
    const demo = {
      id: 'd0000000-0000-4000-8000-000000000001',
      babyId: 'd0000000-0000-4000-8000-0000000000ff',
      type: 'diaper' as const,
      diaperType: 'wet' as const,
      timestamp: '2026-10-17T09:00:00.000Z',
      isDemo: true,
    };
    const personal = {
      id: 'e0000000-0000-4000-8000-000000000001',
      babyId: 'a0000000-0000-4000-8000-000000000001',
      type: 'sleep' as const,
      durationMin: 60,
      timestamp: '2026-10-17T10:00:00.000Z',
    };
    const data: AppData = {
      babies: [baby],
      events: [demo, personal] as unknown as CareEvent[],
      activeTimers: [],
      growthRecords: [],
      milestones: [],
      medications: [],
      medicationAdministrations: [],
      vaccinations: [],
      routines: [],
      schemaVersion: 3,
    };
    const personalEvents = data.events.filter((e) => !e.isDemo);
    expect(personalEvents).toHaveLength(1);
    expect(personalEvents[0].babyId).toBe(baby.id);
    expect(personalEvents.some((e) => e.isDemo)).toBe(false);
  });
});
