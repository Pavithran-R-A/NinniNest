import { describe, it, expect } from 'vitest';
import { validateEvent, validateTimer, appDataSchema } from '../src/models/validation';

const base = {
  id: 'b0000000-0000-4000-8000-000000000001',
  babyId: 'a0000000-0000-4000-8000-000000000001',
  timestamp: '2026-10-17T09:00:00.000Z',
};

describe('pump event schema', () => {
  it('accepts a pump event with side', () => {
    expect(
      validateEvent({ ...base, type: 'pump', amountMl: 90, durationMin: 15, side: 'left' })?.type
    ).toBe('pump');
  });
  it('accepts a pump event without side (back-compat)', () => {
    expect(
      validateEvent({ ...base, type: 'pump', amountMl: 90, durationMin: 15 })
    ).not.toBeNull();
  });
  it('rejects negative amounts and durations', () => {
    expect(validateEvent({ ...base, type: 'pump', amountMl: -5, durationMin: 10 })).toBeNull();
    expect(validateEvent({ ...base, type: 'pump', amountMl: 10, durationMin: -1 })).toBeNull();
  });
});

describe('timer segments validation', () => {
  it('rejects a timer with empty segments', () => {
    expect(
      validateTimer({
        id: 'c0000000-0000-4000-8000-000000000001',
        babyId: base.babyId,
        kind: 'sleep',
        startedAt: base.timestamp,
        segments: [],
      })
    ).toBeNull();
  });

  it('accepts a running timer with segments and lastSide', () => {
    const tm = validateTimer({
      id: 'c0000000-0000-4000-8000-000000000002',
      babyId: base.babyId,
      kind: 'feed_breast',
      startedAt: base.timestamp,
      side: 'left',
      lastSide: 'left',
      segments: [{ start: base.timestamp, end: null }],
    });
    expect(tm?.segments).toHaveLength(1);
  });
});

describe('appDataSchema', () => {
  it('accepts schema v2 shape', () => {
    expect(
      appDataSchema.safeParse({ babies: [], events: [], activeTimers: [], schemaVersion: 2 }).success
    ).toBe(true);
  });
  it('rejects malformed shape', () => {
    expect(appDataSchema.safeParse({ schemaVersion: 2 }).success).toBe(false);
  });
});
