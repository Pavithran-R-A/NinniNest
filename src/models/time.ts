import type { ClockFormat } from '@/src/i18n/strings';

export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return `${h}h ${rem}m`;
}

export function elapsedMinutes(startedAt: string, now: number = Date.now()): number {
  const start = new Date(startedAt).getTime();
  return Math.max(0, (now - start) / 60000);
}

export function toLocalParts(iso: string): { hours: number; minutes: number } {
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

// hour12 is inferred when undefined; an explicit ClockFormat overrides it.
export function formatClock(iso: string, clock?: ClockFormat): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(clock ? { hour12: clock === '12h' } : {}),
  });
}

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function babyAge(birthDate: string, now: Date = new Date()): string {
  const b = new Date(birthDate + 'T00:00:00');
  const ms = now.getTime() - b.getTime();
  if (ms < 0) return 'not born yet';
  const days = Math.floor(ms / 86400000);
  if (days < 7) {
    return days === 0 ? "born today" : `${days} day${days === 1 ? '' : 's'} old`;
  }
  if (days < 70) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} old`;
  }
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 24) {
    return `${months} month${months === 1 ? '' : 's'} old`;
  }
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} old`;
}

export function formatBirthDate(birthDate: string): string {
  const d = new Date(birthDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatMl(ml: number): string {
  return `${Math.round(ml)} mL`;
}

export function formatMlOz(ml: number): string {
  const oz = ml / 29.5735;
  return `${Math.round(ml)} mL · ${oz.toFixed(1)} oz`;
}
