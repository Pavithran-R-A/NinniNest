import { describe, it, expect } from 'vitest';
import { planRoutineTriggers } from '../src/models/notifications';
import type { RoutineTemplate } from '../src/models/types';

function routine(over: Partial<RoutineTemplate> = {}): RoutineTemplate {
  return {
    id: 'r0000000-0000-4000-8000-000000000001',
    babyId: 'a0000000-0000-4000-8000-000000000001',
    title: 'Night feed',
    kind: 'feed',
    timeOfDay: '02:30',
    days: [0, 1, 2, 3, 4, 5, 6],
    active: true,
    ...over,
  };
}

describe('planRoutineTriggers (pure scheduling plan)', () => {
  it('maps every active day to a weekly trigger with expo weekday = day + 1 (Sunday=1)', () => {
    const plan = planRoutineTriggers([routine({ days: [0, 3] })]); // Sunday + Wednesday
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.weekday).sort()).toEqual([1, 4]); // Sunday=1, Wednesday=4
    expect(plan.every((p) => p.hour === 2 && p.minute === 30)).toBe(true);
    expect(plan.every((p) => p.identifier.startsWith('routine-r0000000-0000-4000-8000-000000000001-'))).toBe(true);
  });

  it('produces distinct identifiers per day so re-scheduling cannot collide', () => {
    const plan = planRoutineTriggers([routine()]);
    const ids = new Set(plan.map((p) => p.identifier));
    expect(ids.size).toBe(7);
  });

  it('skips inactive routines and unparsable or out-of-range times', () => {
    expect(planRoutineTriggers([routine({ active: false })])).toHaveLength(0);
    expect(planRoutineTriggers([routine({ timeOfDay: 'not-a-time' })])).toHaveLength(0);
    expect(planRoutineTriggers([routine({ timeOfDay: '24:00' })])).toHaveLength(0);
    expect(planRoutineTriggers([routine({ timeOfDay: '07:60' })])).toHaveLength(0);
    expect(planRoutineTriggers([routine({ timeOfDay: '23:59' })])).toHaveLength(7);
  });

  it('an empty day list schedules nothing; multiple routines combine', () => {
    expect(planRoutineTriggers([routine({ days: [] })])).toHaveLength(0);
    const plan = planRoutineTriggers([
      routine({ days: [1], timeOfDay: '07:00' }),
      routine({ id: 'r0000000-0000-4000-8000-000000000002', days: [1], timeOfDay: '19:00' }),
    ]);
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.hour).sort((a, b) => a - b)).toEqual([7, 19]);
  });
});
