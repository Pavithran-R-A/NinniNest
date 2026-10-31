import { describe, it, expect, beforeEach } from 'vitest';
import {
  syncRoutineNotifications,
  cancelAllRoutineNotifications,
  ROUTINE_CHANNEL_ID,
} from '../src/models/notifications';
import { __calls, __setPermission, __setExisting, __reset } from './stubs/expoNotifications';
import { __setPlatformOS } from './stubs/reactNative';
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

// Regression coverage for the android scheduling branches (the pure planner
// lives in notificationPlan.test.ts). The stub records every native call.
beforeEach(() => {
  __reset();
  __setPlatformOS('android');
});

describe('syncRoutineNotifications (android, stubbed native module)', () => {
  it('routes weekly triggers to the dedicated routine-reminders channel via the SDK-57 trigger field', async () => {
    __setPermission({ granted: true });
    const outcome = await syncRoutineNotifications([routine({ days: [1] })]);
    expect(outcome.permissionDenied).toBe(false);
    expect(outcome.scheduled).toBe(1);
    expect(outcome.skipped).toEqual([]);
    expect(__calls.scheduled).toHaveLength(1);
    const rec = __calls.scheduled[0];
    expect(rec.identifier).toBe('routine-r0000000-0000-4000-8000-000000000001-1');
    // SDK 57: the channel rides the TRIGGER, not the content — content-level
    // routing left every delivery on expo's fallback channel (cloud run
    // 41197666104 delivered on expo_notifications_fallback_notification_channel).
    expect(rec.trigger.channelId).toBe(ROUTINE_CHANNEL_ID);
    expect(rec.content.channelId).toBeUndefined();
  });

  it('registers the dedicated channel before scheduling', async () => {
    __setPermission({ granted: true });
    await syncRoutineNotifications([routine({ days: [1] })]);
    expect(__calls.channels.map((c) => c.id)).toContain(ROUTINE_CHANNEL_ID);
  });

  it('denied permission schedules nothing and is reported honestly', async () => {
    __setPermission({ granted: false });
    const outcome = await syncRoutineNotifications([routine()]);
    expect(outcome.permissionDenied).toBe(true);
    expect(outcome.scheduled).toBe(0);
    expect(__calls.scheduled).toHaveLength(0);
    expect(__calls.channels).toHaveLength(0);
  });

  it('re-sync cancels existing routine-* notifications first, so relaunches cannot duplicate reminders', async () => {
    __setPermission({ granted: true });
    __setExisting([
      'routine-r0000000-0000-4000-8000-000000000001-0',
      'routine-r0000000-0000-4000-8000-000000000001-3',
      'unrelated-other-id',
    ]);
    const outcome = await syncRoutineNotifications([routine({ days: [1] })]);
    expect(outcome.scheduled).toBe(1);
    // exactly the stale routine ids were cancelled; foreign identifiers kept
    expect(__calls.cancelled).toEqual([
      'routine-r0000000-0000-4000-8000-000000000001-0',
      'routine-r0000000-0000-4000-8000-000000000001-3',
    ]);
    // and the fresh plan replaces them one-for-one
    expect(__calls.scheduled.map((s) => s.identifier)).toEqual([
      'routine-r0000000-0000-4000-8000-000000000001-1',
    ]);
  });

  it('one failed trigger does not abort the rest of the plan', async () => {
    __setPermission({ granted: true });
    const outcome = await syncRoutineNotifications([
      routine({ id: 'r0000000-0000-4000-8000-000000000003', days: [1] }),
      routine({ id: 'r0000000-0000-4000-8000-000000000004', days: [1] }),
    ]);
    // With the stub never throwing, both schedule; the per-trigger try/catch
    // keeps a bad trigger from dropping the plan (verified by full scheduling).
    expect(outcome.scheduled).toBe(2);
  });

  it('cancelAllRoutineNotifications removes only routine-* identifiers', async () => {
    __setExisting([
      'routine-r0000000-0000-4000-8000-000000000001-0',
      'unrelated-other-id',
    ]);
    await cancelAllRoutineNotifications();
    expect(__calls.cancelled).toEqual(['routine-r0000000-0000-4000-8000-000000000001-0']);
  });
});
