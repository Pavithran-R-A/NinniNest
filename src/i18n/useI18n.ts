import { useApp } from '@/src/state/AppProvider';
import type { TFunc } from '@/src/i18n/strings';
import { formatClock } from '@/src/models/time';

// Screen-level accessor: t() for strings, clock() for time display honoring the
// user's 12/24-hour preference.
export function useI18n(): { t: TFunc; clock: (iso: string) => string } {
  const { t, clockFormat } = useApp();
  return { t, clock: (iso: string) => formatClock(iso, clockFormat) };
}
