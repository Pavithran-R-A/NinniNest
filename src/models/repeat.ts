import type { CareEvent } from './types';

const LABELS: Record<CareEvent['type'], string> = {
  feed_bottle: 'bottle feed',
  feed_breast: 'breastfeed',
  feed_solids: 'solid food',
  diaper: 'diaper change',
  sleep: 'sleep',
  pump: 'pumping session',
  tummy_time: 'tummy time',
  note: 'note',
};

export function eventLabel(type: CareEvent['type']): string {
  return LABELS[type];
}

export function lastRepeatable(events: CareEvent[]): CareEvent | null {
  const sorted = [...events].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return sorted.find((e) => e.type !== 'note') ?? null;
}
