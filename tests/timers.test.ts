import { describe, it, expect } from 'vitest';
import {
  ozToMl, mlToOz, timerElapsedMinutes, timerIsPaused, timerRunningMinutes,
  resumeTimer, pauseTimer, switchSide, switchSideFrom, summarizeSides,
  sanitizeSegments, totalSegmentMinutes, ML_PER_OZ,
} from '../src/models/timers';
import type { ActiveTimer, TimerSegment } from '../src/models/types';

const T0 = Date.parse('2026-10-17T09:00:00.000Z');
const t = (offsetMin: number) => new Date(T0 + offsetMin * 60000).toISOString();

const timer = (segments: TimerSegment[], extra: Partial<ActiveTimer> = {}): ActiveTimer => ({
  id: 'c0000000-0000-4000-8000-000000000001',
  babyId: 'a0000000-0000-4000-8000-000000000001',
  kind: 'feed_breast',
  startedAt: segments[0].start,
  segments,
  ...extra,
});

describe('unit conversion', () => {
  it('converts oz to mL and back', () => {
    expect(ozToMl(1)).toBeCloseTo(ML_PER_OZ, 4);
    expect(mlToOz(ML_PER_OZ)).toBeCloseTo(1, 4);
    expect(ozToMl(4)).toBeCloseTo(118.294, 3);
  });
  it('round trip is stable within display precision', () => {
    const ml = 150;
    expect(ozToMl(mlToOz(ml))).toBeCloseTo(ml, 6);
  });
});

describe('segment timers', () => {
  it('measures a single running segment against now', () => {
    const tm = timer([{ start: t(0), end: null }]);
    expect(timerElapsedMinutes(tm, T0 + 30 * 60000)).toBeCloseTo(30, 6);
    expect(timerIsPaused(tm)).toBe(false);
  });

  it('measures paused duration without wall clock', () => {
    const tm = timer([
      { start: t(0), end: t(10) },
      { start: t(20), end: t(25) },
    ]);
    expect(timerIsPaused(tm)).toBe(true);
    expect(timerElapsedMinutes(tm)).toBeCloseTo(15, 6);
    expect(timerRunningMinutes(tm)).toBe(0);
  });

  it('pause then resume accumulates across segments', () => {
    let tm = timer([{ start: t(0), end: null }]);
    tm = pauseTimer(tm, t(10));
    expect(timerIsPaused(tm)).toBe(true);
    expect(timerElapsedMinutes(tm, T0 + 40 * 60000)).toBeCloseTo(10, 6);
    tm = resumeTimer(tm, t(20));
    expect(timerIsPaused(tm)).toBe(false);
    expect(timerElapsedMinutes(tm, T0 + 40 * 60000)).toBeCloseTo(30, 6);
  });

  it('pause is a no-op when already paused; resume adds a segment', () => {
    const running = timer([{ start: t(0), end: null }]);
    expect(pauseTimer(running, t(5)).segments).toHaveLength(1);
    const paused = timer([{ start: t(0), end: t(5) }]);
    const resumed = resumeTimer(paused, t(9));
    expect(resumed.segments).toHaveLength(2);
    expect(resumed.segments[1].start).toBe(t(9));
    expect(resumed.segments[1].end).toBeNull();
  });

  it('switchSideFrom closes the running segment and starts a new one', () => {
    let tm = timer([{ start: t(0), end: null }], { side: 'left', lastSide: 'left' });
    tm = switchSideFrom(tm, 'right', t(12));
    expect(tm.segments).toHaveLength(2);
    expect(tm.segments[0].end).toBe(t(12));
    expect(tm.side).toBe('right');
    expect(tm.lastSide).toBe('right');
    expect(timerIsPaused(tm)).toBe(false);
    expect(timerElapsedMinutes(tm, T0 + 30 * 60000)).toBeCloseTo(30, 6);
  });

  it('switchSide toggles from current side', () => {
    let tm = timer([{ start: t(0), end: null }], { side: 'right', lastSide: 'right' });
    tm = switchSide(tm, t(5));
    expect(tm.side).toBe('left');
    expect(tm.lastSide).toBe('left');
  });

  it('ignores side switching for non-breast kinds', () => {
    const tm = timer([{ start: t(0), end: null }], { kind: 'sleep' });
    expect(switchSideFrom(tm, 'right', t(5))).toBe(tm);
  });

  it('summarizeSides reflects the active side', () => {
    expect(summarizeSides(timer([{ start: t(0), end: null }], { side: 'left' }))).toBe('left');
    expect(summarizeSides(timer([{ start: t(0), end: null }], {}))).toBe('both');
  });
});

describe('sanitizeSegments', () => {
  it('drops NaN starts, inverted ranges and future-ended segments', () => {
    const now = T0 + 60 * 60000;
    const out = sanitizeSegments(
      [
        { start: 'nope', end: null },
        { start: t(20), end: t(10) },
        { start: t(30), end: t(200) },
        { start: t(40), end: t(50) },
        { start: t(50), end: null },
      ],
      now
    );
    expect(out).toHaveLength(2);
    expect(out[0].start).toBe(t(40));
    expect(out[1].end).toBeNull();
  });

  it('always leaves at least one segment', () => {
    const out = sanitizeSegments([{ start: 'garbage', end: 'garbage' }], T0);
    expect(out).toHaveLength(1);
    expect(out[0].end).toBeNull();
  });
});

describe('overnight and midnight safety', () => {
  it('sleep spanning midnight is measured by timestamps, not local day', () => {
    const tm = timer([
      { start: '2026-10-17T23:00:00.000Z', end: '2026-10-18T07:00:00.000Z' },
    ], { kind: 'sleep' });
    expect(timerElapsedMinutes(tm)).toBe(480);
    expect(totalSegmentMinutes(tm.segments)).toBe(480);
  });

  it('timezone change does not distort elapsed time (UTC math)', () => {
    const tm = timer([{ start: '2026-10-17T09:00:00.000Z', end: '2026-10-17T10:00:00.000Z' }]);
    expect(timerElapsedMinutes(tm)).toBe(60);
  });
});
