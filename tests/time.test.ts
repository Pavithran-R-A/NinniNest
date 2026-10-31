import { describe, it, expect } from 'vitest';
import { formatDuration, elapsedMinutes, babyAge, formatMlOz, localDateKey } from '../src/models/time';

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(45)).toBe('45m');
  });
  it('formats hours and minutes', () => {
    expect(formatDuration(135)).toBe('2h 15m');
  });
  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });
  it('never negative', () => {
    expect(formatDuration(-10)).toBe('0m');
  });
});

describe('elapsedMinutes', () => {
  it('computes elapsed minutes from a timestamp', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const now = start + 90 * 60000;
    expect(elapsedMinutes(new Date(start).toISOString(), now)).toBeCloseTo(90);
  });
  it('clamps future timestamps to zero', () => {
    expect(elapsedMinutes(new Date(Date.now() + 600000).toISOString(), Date.now())).toBe(0);
  });
});

describe('babyAge', () => {
  it('says born today', () => {
    expect(babyAge(localDateKey(new Date()))).toBe('born today');
  });
  it('counts days under a week', () => {
    const d = new Date(Date.now() - 3 * 86400000);
    expect(babyAge(localDateKey(d))).toBe('3 days old');
  });
  it('counts weeks under 10', () => {
    const d = new Date(Date.now() - 21 * 86400000);
    expect(babyAge(localDateKey(d))).toBe('3 weeks old');
  });
  it('counts months', () => {
    // Anchor to the first of the month: subtracting months from the 29th-31st
    // rolls over (Oct 31 - 4 months normalizes to Jul 1 on JS Date) and broke
    // this test on the last days of long months (found on CI, Oct 31).
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 4);
    expect(babyAge(localDateKey(d))).toBe('4 months old');
  });
  it('rejects future dates gracefully', () => {
    const d = new Date(Date.now() + 86400000);
    expect(babyAge(localDateKey(d))).toBe('not born yet');
  });
});

describe('formatMlOz', () => {
  it('converts mL to oz', () => {
    expect(formatMlOz(120)).toBe('120 mL · 4.1 oz');
  });
});
