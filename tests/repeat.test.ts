import { describe, it, expect } from 'vitest';
import { eventLabel, lastRepeatable } from '../src/models/repeat';
import type { CareEvent } from '../src/models/types';

const e = (over: Partial<CareEvent> & { type: CareEvent['type'] }): CareEvent => ({
  id: 'f0000000-0000-4000-8000-000000000001',
  babyId: 'a0000000-0000-4000-8000-000000000001',
  timestamp: '2026-10-17T09:00:00.000Z',
  ...over,
} as CareEvent);

describe('eventLabel', () => {
  it('labels every type', () => {
    expect(eventLabel('feed_bottle')).toBe('bottle feed');
    expect(eventLabel('tummy_time')).toBe('tummy time');
    expect(eventLabel('note')).toBe('note');
  });
});

describe('lastRepeatable', () => {
  it('returns the most recent non-note event', () => {
    const events = [
      e({ type: 'diaper', diaperType: 'wet', timestamp: '2026-10-17T08:00:00.000Z' }),
      e({ type: 'note', note: 'x', timestamp: '2026-10-17T09:00:00.000Z' }),
      e({ type: 'feed_bottle', amountMl: 90, milkType: 'formula', timestamp: '2026-10-17T08:30:00.000Z' }),
    ];
    const last = lastRepeatable(events);
    expect(last?.type).toBe('feed_bottle');
  });

  it('returns null when there is nothing but notes', () => {
    expect(lastRepeatable([e({ type: 'note', note: 'x' })])).toBeNull();
    expect(lastRepeatable([])).toBeNull();
  });
});
