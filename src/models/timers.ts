import type { ActiveTimer, TimerSegment } from './types';

export const ML_PER_OZ = 29.5735;

export function ozToMl(oz: number): number {
  return oz * ML_PER_OZ;
}

export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

function segmentMinutes(s: TimerSegment, now: number): number {
  const start = Date.parse(s.start);
  const end = s.end ? Date.parse(s.end) : now;
  return Math.max(0, (end - start) / 60000);
}

export function timerElapsedMinutes(timer: ActiveTimer, now: number = Date.now()): number {
  return timer.segments.reduce((sum, s) => sum + segmentMinutes(s, now), 0);
}

export function timerIsPaused(timer: ActiveTimer): boolean {
  const last = timer.segments[timer.segments.length - 1];
  return !!last && last.end !== null;
}

export function timerRunningMinutes(timer: ActiveTimer, now: number = Date.now()): number {
  const last = timer.segments[timer.segments.length - 1];
  if (!last || last.end !== null) return 0;
  return segmentMinutes(last, now);
}

export function resumeTimer(timer: ActiveTimer, at: string = new Date().toISOString()): ActiveTimer {
  if (!timerIsPaused(timer)) return timer;
  return { ...timer, segments: [...timer.segments, { start: at, end: null }] };
}

export function pauseTimer(timer: ActiveTimer, at: string = new Date().toISOString()): ActiveTimer {
  if (timerIsPaused(timer)) return timer;
  const segments = [...timer.segments];
  const last = segments[segments.length - 1];
  segments[segments.length - 1] = { ...last, end: at };
  return { ...timer, segments };
}

export function switchSideFrom(
  timer: ActiveTimer,
  side: 'left' | 'right',
  at: string = new Date().toISOString()
): ActiveTimer {
  if (timer.kind !== 'feed_breast') return timer;
  const paused = pauseTimer(timer, at);
  const resumed: ActiveTimer = { ...paused, side, lastSide: side };
  return resumeTimer(resumed, at);
}

export function switchSide(timer: ActiveTimer, at: string = new Date().toISOString()): ActiveTimer {
  if (timer.kind !== 'feed_breast') return timer;
  const nextSide: 'left' | 'right' = timer.side === 'left' ? 'right' : 'left';
  return switchSideFrom(timer, nextSide, at);
}

export function summarizeSides(timer: ActiveTimer): 'left' | 'right' | 'both' {
  if (!timer.side) return 'both';
  return timer.side;
}

export function sanitizeSegments(segments: TimerSegment[], now: number = Date.now()): TimerSegment[] {
  const clean: TimerSegment[] = [];
  for (const s of segments) {
    const start = Date.parse(s.start);
    if (Number.isNaN(start)) continue;
    const end = s.end === null ? null : Date.parse(s.end);
    if (end !== null && (Number.isNaN(end) || end < start)) continue;
    if (end !== null && end > now + 60000) continue;
    clean.push({ start: s.start, end: s.end });
  }
  if (clean.length === 0) return [{ start: new Date(now).toISOString(), end: null }];
  return clean;
}

export function totalSegmentMinutes(segments: TimerSegment[], now: number = Date.now()): number {
  return segments.reduce((sum, s) => sum + segmentMinutes(s, now), 0);
}
