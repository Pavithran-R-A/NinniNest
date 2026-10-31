// Minimal shape-compatible stub: the pure planner functions in
// src/models/notifications.ts never touch the native module; the sync/cancel/
// count helpers do. This stub records their calls so regression tests can
// assert scheduling behavior (channel routing, dedupe, permission gating)
// without the native module. Defaults preserve the original static shape.
export const AndroidImportance = { DEFAULT: 3 } as const;

export interface RecordedSchedule {
  identifier: string;
  content: Record<string, unknown>;
  trigger: Record<string, unknown>;
}

export const __calls = {
  scheduled: [] as RecordedSchedule[],
  cancelled: [] as string[],
  channels: [] as Array<{ id: string; channel: Record<string, unknown> }>,
};

let permission = { granted: false, status: 'undetermined', canAskAgain: true };
let existing: Array<{ identifier: string }> = [];

export function __setPermission(p: { granted: boolean }): void {
  permission = { ...permission, ...p };
}

export function __setExisting(ids: string[]): void {
  existing = ids.map((identifier) => ({ identifier }));
}

export function __reset(): void {
  __calls.scheduled = [];
  __calls.cancelled = [];
  __calls.channels = [];
  permission = { granted: false, status: 'undetermined', canAskAgain: true };
  existing = [];
}

export async function getPermissionsAsync() {
  return { ...permission };
}
export async function requestPermissionsAsync() {
  return { granted: permission.granted };
}
export async function getAllScheduledNotificationsAsync() {
  return existing;
}
export async function cancelScheduledNotificationAsync(id: string) {
  __calls.cancelled.push(id);
  existing = existing.filter((n) => n.identifier !== id);
}
export async function scheduleNotificationAsync(builder: RecordedSchedule) {
  __calls.scheduled.push(builder);
}
export async function setNotificationChannelAsync(id: string, channel: Record<string, unknown>) {
  __calls.channels.push({ id, channel });
}
