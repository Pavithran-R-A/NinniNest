// Minimal shape-compatible stub: the pure planner functions in
// src/models/notifications.ts never touch the native module; only the
// sync/cancel/count helpers do, and those are exercised on-device.
// `__setPlatformOS` lets a test opt into the android branches; the default
// stays 'web' so every existing consumer behaves exactly as before.
let currentOS = 'web';

export function __setPlatformOS(os: string): void {
  currentOS = os;
}

export const Platform = {
  get OS() {
    return currentOS;
  },
  select: <T,>(options: { default?: T } & Partial<Record<string, T>>): T | undefined =>
    options.web ?? options.default,
};
