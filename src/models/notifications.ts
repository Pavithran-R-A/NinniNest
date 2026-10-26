import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RoutineTemplate } from './types';

export interface ScheduleOutcome {
  scheduled: number;
  skipped: string[]; // reasons per unscheduled routine
  permissionDenied: boolean;
}

export const ROUTINE_CHANNEL_ID = 'routine-reminders';

export interface PlannedTrigger {
  identifier: string;
  weekday: number; // 1..7, Sunday = 1 (expo-notifications convention)
  hour: number;
  minute: number;
}

/**
 * Pure scheduling plan: which weekly triggers the routine set should produce.
 * `days` use 0=Sunday..6=Saturday (Date.getDay convention, see routines.ts);
 * expo weekday is 1=Sunday, hence +1. Inactive routines and unparsable
 * times produce nothing. Keeping this pure makes the weekday/time mapping
 * unit-testable without the native notifications module.
 */
export function planRoutineTriggers(routines: RoutineTemplate[]): PlannedTrigger[] {
  const plan: PlannedTrigger[] = [];
  for (const routine of routines) {
    if (!routine.active) continue;
    const [h, m] = routine.timeOfDay.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) continue;
    for (let day = 0; day < 7; day++) {
      if (!routine.days.includes(day)) continue;
      plan.push({
        identifier: `routine-${routine.id}-${day}`,
        weekday: day + 1,
        hour: h,
        minute: m,
      });
    }
  }
  return plan;
}

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

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ROUTINE_CHANNEL_ID, {
    name: 'Routine reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
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

  await ensureAndroidChannel();

  const plan = planRoutineTriggers(routines);
  for (const trigger of plan) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: trigger.identifier,
        content: {
          title: 'NinniNest routine',
          body: 'Scheduled reminder. Log it in the journal if it happened.',
          sound: false,
          ...(Platform.OS === 'android' ? { channelId: ROUTINE_CHANNEL_ID } : {}),
        },
        trigger: {
          type: 'weekly',
          weekday: trigger.weekday,
          hour: trigger.hour,
          minute: trigger.minute,
        } as Notifications.WeeklyTriggerInput,
      });
      outcome.scheduled += 1;
    } catch {
      // individual trigger failure must not abort the rest
    }
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

