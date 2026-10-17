import type { CareEvent, GrowthRecord, MedicationAdministration, MilestoneRecord } from './types';
import { localKeyOf as localDateKey, addDays } from './calendar';

export interface DayWindow {
  startKey: string; // inclusive local YYYY-MM-DD
  endKey: string; // inclusive local YYYY-MM-DD
}

export function lastNDays(n: number, now: Date = new Date()): DayWindow {
  const endKey = localDateKey(now);
  return { startKey: addDays(endKey, -(n - 1)), endKey };
}

export function eventDateKey(e: CareEvent): string {
  return localDateKey(new Date(e.timestamp));
}

function inWindow(e: CareEvent, w: DayWindow): boolean {
  const k = eventDateKey(e);
  return k >= w.startKey && k <= w.endKey;
}

export function eventsForWindow(events: CareEvent[], w: DayWindow, babyId?: string): CareEvent[] {
  return events.filter((e) => (!babyId || e.babyId === babyId) && inWindow(e, w));
}

// ---- Feedings ----

export interface FeedSummary {
  bottleCount: number;
  bottleTotalMl: number;
  bottleMlByMilkType: { breast_milk: number; formula: number; mixed: number };
  breastSessionCount: number;
  breastTotalMin: number;
  breastMinBySide: { left: number; right: number; both: number };
  solidsCount: number;
}

export function summarizeFeeds(events: CareEvent[], w: DayWindow, babyId?: string): FeedSummary {
  const s: FeedSummary = {
    bottleCount: 0,
    bottleTotalMl: 0,
    bottleMlByMilkType: { breast_milk: 0, formula: 0, mixed: 0 },
    breastSessionCount: 0,
    breastTotalMin: 0,
    breastMinBySide: { left: 0, right: 0, both: 0 },
    solidsCount: 0,
  };
  for (const e of eventsForWindow(events, w, babyId)) {
    if (e.type === 'feed_bottle') {
      s.bottleCount += 1;
      s.bottleTotalMl += e.amountMl;
      s.bottleMlByMilkType[e.milkType] += e.amountMl;
    } else if (e.type === 'feed_breast') {
      s.breastSessionCount += 1;
      s.breastTotalMin += e.durationMin;
      s.breastMinBySide[e.side] += e.durationMin;
    } else if (e.type === 'feed_solids') {
      s.solidsCount += 1;
    }
  }
  return s;
}

// ---- Pumping ----

export interface PumpSummary {
  sessionCount: number;
  totalMl: number;
  totalMin: number;
}

export function summarizePumping(events: CareEvent[], w: DayWindow, babyId?: string): PumpSummary {
  let sessionCount = 0;
  let totalMl = 0;
  let totalMin = 0;
  for (const e of eventsForWindow(events, w, babyId)) {
    if (e.type === 'pump') {
      sessionCount += 1;
      totalMl += e.amountMl;
      totalMin += e.durationMin;
    }
  }
  return { sessionCount, totalMl, totalMin };
}

// ---- Sleep ----

export interface SleepSummary {
  totalMin: number;
  sessionCount: number;
  nightMin: number; // sessions starting 18:00–06:00 local
  napMin: number;
  byDay: { date: string; minutes: number }[];
}

// 18:00–06:00 local start time counts as night; everything else is a nap.
function isNightStart(iso: string): boolean {
  const { hours } = { hours: new Date(iso).getHours() };
  return hours >= 18 || hours < 6;
}

export function summarizeSleep(events: CareEvent[], w: DayWindow, babyId?: string): SleepSummary {
  const byDay = new Map<string, number>();
  let nightMin = 0;
  let napMin = 0;
  let sessionCount = 0;
  for (const e of eventsForWindow(events, w, babyId)) {
    if (e.type !== 'sleep') continue;
    sessionCount += 1;
    const k = eventDateKey(e);
    byDay.set(k, (byDay.get(k) ?? 0) + e.durationMin);
    if (isNightStart(e.timestamp)) nightMin += e.durationMin;
    else napMin += e.durationMin;
  }
  const days: { date: string; minutes: number }[] = [];
  let cursor = w.startKey;
  // Guard against inverted windows: only iterate when start <= end.
  while (cursor <= w.endKey && days.length < 400) {
    days.push({ date: cursor, minutes: byDay.get(cursor) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  return { totalMin: nightMin + napMin, sessionCount, nightMin, napMin, byDay: days };
}

// ---- Diapers ----

export interface DiaperSummary {
  total: number;
  wet: number;
  dirty: number;
  both: number;
}

export function summarizeDiapers(events: CareEvent[], w: DayWindow, babyId?: string): DiaperSummary {
  const s: DiaperSummary = { total: 0, wet: 0, dirty: 0, both: 0 };
  for (const e of eventsForWindow(events, w, babyId)) {
    if (e.type === 'diaper') {
      s.total += 1;
      s[e.diaperType] += 1;
    }
  }
  return s;
}

// ---- Tummy time ----

export function summarizeTummyTime(events: CareEvent[], w: DayWindow, babyId?: string) {
  let totalMin = 0;
  let sessionCount = 0;
  for (const e of eventsForWindow(events, w, babyId)) {
    if (e.type === 'tummy_time') {
      totalMin += e.durationMin;
      sessionCount += 1;
    }
  }
  return { totalMin, sessionCount };
}

// ---- Activity overview (7d / 30d) ----

export interface ActivityDay {
  date: string;
  feeds: number;
  diapers: number;
  sleepMin: number;
  tummyMin: number;
}

export function activityByDay(events: CareEvent[], w: DayWindow, babyId?: string): ActivityDay[] {
  const map = new Map<string, ActivityDay>();
  for (const e of eventsForWindow(events, w, babyId)) {
    const k = eventDateKey(e);
    const day = map.get(k) ?? { date: k, feeds: 0, diapers: 0, sleepMin: 0, tummyMin: 0 };
    if (e.type === 'feed_bottle' || e.type === 'feed_breast' || e.type === 'feed_solids') day.feeds += 1;
    else if (e.type === 'diaper') day.diapers += 1;
    else if (e.type === 'sleep') day.sleepMin += e.durationMin;
    else if (e.type === 'tummy_time') day.tummyMin += e.durationMin;
    map.set(k, day);
  }
  const days: ActivityDay[] = [];
  let cursor = w.startKey;
  while (cursor <= w.endKey && days.length < 400) {
    days.push(map.get(cursor) ?? { date: cursor, feeds: 0, diapers: 0, sleepMin: 0, tummyMin: 0 });
    cursor = addDays(cursor, 1);
  }
  return days;
}

// ---- Growth / medications / milestones histories ----

export function growthHistory(records: GrowthRecord[], babyId: string): GrowthRecord[] {
  return records.filter((g) => g.babyId === babyId).sort((a, b) => a.date.localeCompare(b.date));
}

export function medicationHistory(
  administrations: MedicationAdministration[],
  babyId: string,
  w?: DayWindow
): MedicationAdministration[] {
  return administrations
    .filter((a) => a.babyId === babyId && (!w || (localDateKey(new Date(a.timestamp)) >= w.startKey && localDateKey(new Date(a.timestamp)) <= w.endKey)))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function milestoneTimeline(milestones: MilestoneRecord[], babyId: string): MilestoneRecord[] {
  return milestones.filter((m) => m.babyId === babyId).sort((a, b) => a.date.localeCompare(b.date));
}
