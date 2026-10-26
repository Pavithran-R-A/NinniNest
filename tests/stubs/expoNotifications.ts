// Minimal shape-compatible stub: the pure planner functions in
// src/models/notifications.ts never touch the native module; only the
// sync/cancel/count helpers do, and those are exercised on-device.
export const AndroidImportance = { DEFAULT: 3 } as const;

export async function getPermissionsAsync() {
  return { granted: false, status: 'undetermined', canAskAgain: true };
}
export async function requestPermissionsAsync() {
  return { granted: false };
}
export async function getAllScheduledNotificationsAsync() {
  return [];
}
export async function cancelScheduledNotificationAsync(_id: string) {}
export async function scheduleNotificationAsync(_builder: unknown) {}
export async function setNotificationChannelAsync(_id: string, _channel: unknown) {}
