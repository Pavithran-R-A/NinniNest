import type { ActiveTimer, AppData, Baby, CareEvent } from './types';

const DEMO_BABY_ID = 'd0000000-0000-4000-8000-000000000001';

function iso(minsAgo: number): string {
  return new Date(Date.now() - minsAgo * 60000).toISOString();
}

function uid(n: number): string {
  const hex = String(n).padStart(12, '0');
  return `e0000000-0000-4000-8000-${hex}`;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return uid(seq);
}

export function buildDemoData(): AppData {
  seq = 0;
  const baby: Baby = {
    id: DEMO_BABY_ID,
    name: 'Aru (Demo)',
    birthDate: new Date(Date.now() - 42 * 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    isDemo: true,
  };

  const mk = (e: CareEvent): CareEvent => {
    return { ...e, id: nextId(), babyId: DEMO_BABY_ID, isDemo: true } as CareEvent;
  };

  const events: CareEvent[] = [
    mk({ type: 'sleep', durationMin: 95, timestamp: iso(150), note: 'Morning nap' } as CareEvent),
    mk({ type: 'feed_breast', durationMin: 14, side: 'left', timestamp: iso(125) } as CareEvent),
    mk({ type: 'diaper', diaperType: 'wet', timestamp: iso(118) } as CareEvent),
    mk({ type: 'feed_bottle', amountMl: 70, milkType: 'formula', timestamp: iso(80) } as CareEvent),
    mk({ type: 'tummy_time', durationMin: 6, timestamp: iso(65) } as CareEvent),
    mk({ type: 'diaper', diaperType: 'dirty', timestamp: iso(50) } as CareEvent),
    mk({ type: 'feed_breast', durationMin: 18, side: 'right', timestamp: iso(38) } as CareEvent),
    mk({ type: 'pump', amountMl: 60, durationMin: 15, timestamp: iso(30) } as CareEvent),
    mk({ type: 'feed_solids', foodDescription: 'A few spoons of rice cereal', reaction: 'neutral', timestamp: iso(22) } as CareEvent),
    mk({ type: 'diaper', diaperType: 'both', timestamp: iso(15) } as CareEvent),
    mk({ type: 'note', note: 'Very settled after the bath.', timestamp: iso(10) } as CareEvent),
  ];

  const activeTimers: ActiveTimer[] = [
    {
      id: 'd0000000-0000-4000-8000-00000000aa01',
      babyId: DEMO_BABY_ID,
      kind: 'sleep',
      startedAt: iso(25),
      segments: [{ start: iso(25), end: null }],
      isDemo: true,
    },
  ];

  return { babies: [baby], events, activeTimers, schemaVersion: 2 };
}

export const DEMO_BABY_ID_CONSTANT = DEMO_BABY_ID;
