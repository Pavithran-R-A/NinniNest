import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RoutineTemplate } from './types';

export interface ScheduleOutcome {
  scheduled: number;
  skipped: string[]; // reasons per unscheduled routine
  permissionDenied: boolean;
}

const WEEKDAY_IDS: (number | null)[] = [];

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.status === 'undetermined' || !('canAskAgain' in current) || current.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  }
  return false;
}

function triggerFor(routine: RoutineTemplate, dayOffset: number): Notifications.WeeklyTriggerInput | null {
  if (!routine.days.includes(dayOffset % 7)) return null;
  const [h, m] = routine.timeOfDay.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return {
    type: 'weekly',
    weekday: (dayOffset % 7) + 1, // expo-notifications uses 1..7 (Sunday=1)
    hour: h,
    minute: m,
  } as Notifications.WeeklyTriggerInput;
}

// Schedules weekly local notifications for every active routine. Reminders are
// informational only: they never write medication administrations or journal events.
export async function syncRoutineNotifications(
  routines: RoutineTemplate[]
): Promise<ScheduleOutcome> {
  const outcome: ScheduleOutcome = { scheduled: 0, skipped: [], permissionDenied: false };
  if (Platform.OS === 'web') {
    outcome.skipped.push('notifications are not available on web');
    return outcome;
  }
  const granted = await ensurePermission();
  if (!granted) {
    outcome.permissionDenied = true;
    outcome.skipped.push('notification permission denied');
    return outcome;
  }

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.identifier.startsWith('routine-')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  for (const routine of routines) {
    if (!routine.active) continue;
    let scheduledAny = false;
    for (let day = 0; day < 7; day++) {
      const trigger = triggerFor(routine, day);
      if (!trigger) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `routine-${routine.id}-${day}`,
          content: {
            title: routine.title,
            body: 'Scheduled reminder from NinniNest. Log it in the journal if it happened.',
            sound: false,
          },
          trigger,
        });
        scheduledAny = true;
        outcome.scheduled += 1;
      } catch {
        // individual trigger failure must not abort the rest
      }
    }
    if (!scheduledAny) outcome.skipped.push(`${routine.title}: nothing to schedule`);
  }
  return outcome;
}

export async function cancelAllRoutineNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.identifier.startsWith('routine-')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
}

export async function countScheduledRoutineNotifications(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  return existing.filter((n) => n.identifier.startsWith('routine-')).length;
}

export { WEEKDAY_IDS };
