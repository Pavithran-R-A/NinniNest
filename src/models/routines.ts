import type { RoutineTemplate } from './types';

// 0=Sunday..6=Saturday, matching Date.getDay().
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isRoutineDueToday(routine: RoutineTemplate, now: Date = new Date()): boolean {
  if (!routine.active) return false;
  return routine.days.includes(now.getDay());
}

export function routinesDueToday(templates: RoutineTemplate[], now: Date = new Date()): RoutineTemplate[] {
  return templates
    .filter((r) => isRoutineDueToday(r, now))
    .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
}

// "HH:mm" is treated as local wall-clock. Recurrence across DST/timezone changes is
// evaluated per-day from the local clock, so a 07:00 routine stays 07:00 locally.
export function routineSortKey(r: RoutineTemplate): number {
  const [h, m] = r.timeOfDay.split(':').map(Number);
  return h * 60 + m;
}
