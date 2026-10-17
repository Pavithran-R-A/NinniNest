import { describe, it, expect } from 'vitest';
import { isCalendarValid, isLeapYear, isValidBirthDate, daysBetween, addDays } from '../src/models/calendar';
import {
  summarizeFeeds, summarizeSleep, summarizeDiapers, summarizePumping,
  summarizeTummyTime, activityByDay, lastNDays, growthHistory, milestoneTimeline,
  type DayWindow,
} from '../src/models/analytics';
import { csvEscape, eventsToCsv } from '../src/models/csv';
import { dryRunParse, mergeData, buildBackup, BACKUP_VERSION } from '../src/models/backup';
import type { AppData, Baby, CareEvent } from '../src/models/types';

const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};

function ev(type: string, iso: string, extra: Record<string, unknown> = {}): CareEvent {
  return {
    id: crypto.randomUUID(),
    babyId: BABY.id,
    type,
    timestamp: iso,
    ...extra,
  } as unknown as CareEvent;
}

// Fixed "now" so window tests are deterministic.
const NOW = new Date(2026, 9, 17, 12, 0, 0); // 2026-10-17 local noon

describe('calendar validation', () => {
  it('accepts real dates', () => {
    expect(isCalendarValid('2026-02-28')).toBe(true);
    expect(isCalendarValid('2024-02-29')).toBe(true); // leap year
    expect(isCalendarValid('2026-12-31')).toBe(true);
  });
  it('rejects impossible February dates', () => {
    expect(isCalendarValid('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isCalendarValid('2026-02-30')).toBe(false);
    expect(isCalendarValid('2026-02-31')).toBe(false);
  });
  it('rejects impossible months and days', () => {
    expect(isCalendarValid('2026-13-01')).toBe(false);
    expect(isCalendarValid('2026-00-10')).toBe(false);
    expect(isCalendarValid('2026-04-31')).toBe(false); // April has 30 days
    expect(isCalendarValid('2026-06-31')).toBe(false);
  });
  it('handles leap-century rules', () => {
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
    expect(isLeapYear(1900)).toBe(false); // divisible by 100 not 400
    expect(isLeapYear(2024)).toBe(true);
    expect(isCalendarValid('2000-02-29')).toBe(true);
    expect(isCalendarValid('1900-02-29')).toBe(false);
  });
  it('rejects malformed strings', () => {
    expect(isCalendarValid('2026-2-1')).toBe(false);
    expect(isCalendarValid('not-a-date')).toBe(false);
    expect(isCalendarValid('')).toBe(false);
  });
  it('validates birth dates against today', () => {
    expect(isValidBirthDate('2026-08-14', NOW)).toBe(true);
    expect(isValidBirthDate('2027-01-01', NOW)).toBe(false); // future
    expect(isValidBirthDate('2026-02-30', NOW)).toBe(false); // impossible
    expect(isValidBirthDate('1899-12-31', NOW)).toBe(false); // absurd past
  });
  it('computes day differences and additions across month boundaries', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-09-30', '2026-10-01')).toBe(1);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap Feb
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('analytics: feeding summaries', () => {
  const w: DayWindow = { startKey: '2026-10-15', endKey: '2026-10-17' };
  it('totals bottle mL by milk type (mixed counted separately)', () => {
    const s = summarizeFeeds(
      [
        ev('feed_bottle', '2026-10-15T09:00:00Z', { amountMl: 60, milkType: 'breast_milk' }),
        ev('feed_bottle', '2026-10-15T13:00:00Z', { amountMl: 90, milkType: 'formula' }),
        ev('feed_bottle', '2026-10-16T17:00:00Z', { amountMl: 70, milkType: 'mixed' }),
      ],
      w,
      BABY.id
    );
    expect(s.bottleCount).toBe(3);
    expect(s.bottleTotalMl).toBe(220);
    expect(s.bottleMlByMilkType.breast_milk).toBe(60);
    expect(s.bottleMlByMilkType.formula).toBe(90);
    expect(s.bottleMlByMilkType.mixed).toBe(70);
  });
  it('splits breastfeeding time by side and totals', () => {
    const s = summarizeFeeds(
      [
        ev('feed_breast', '2026-10-15T09:00:00Z', { durationMin: 12, side: 'left' }),
        ev('feed_breast', '2026-10-15T13:00:00Z', { durationMin: 15, side: 'right' }),
        ev('feed_breast', '2026-10-16T17:00:00Z', { durationMin: 8, side: 'both' }),
      ],
      w,
      BABY.id
    );
    expect(s.breastMinBySide.left).toBe(12);
    expect(s.breastMinBySide.right).toBe(15);
    expect(s.breastMinBySide.both).toBe(8);
    expect(s.breastTotalMin).toBe(35);
  });
  it('excludes events outside the window and other babies', () => {
    const s = summarizeFeeds(
      [
        ev('feed_bottle', '2026-10-14T23:00:00Z', { amountMl: 100, milkType: 'formula' }),
        ev('feed_bottle', '2026-10-16T10:00:00Z', { amountMl: 50, milkType: 'formula', babyId: 'b0000000-0000-4000-8000-000000000009' }),
        ev('feed_bottle', '2026-10-16T10:00:00Z', { amountMl: 40, milkType: 'formula' }),
      ],
      w,
      BABY.id
    );
    expect(s.bottleCount).toBe(1);
    expect(s.bottleTotalMl).toBe(40);
  });
});

describe('analytics: pumping', () => {
  const w: DayWindow = { startKey: '2026-10-15', endKey: '2026-10-17' };
  it('counts sessions, volume and time', () => {
    const s = summarizePumping(
      [
        ev('pump', '2026-10-15T09:00:00Z', { amountMl: 80, durationMin: 15 }),
        ev('pump', '2026-10-16T13:00:00Z', { amountMl: 60, durationMin: 12 }),
      ],
      w,
      BABY.id
    );
    expect(s).toEqual({ sessionCount: 2, totalMl: 140, totalMin: 27 });
  });
});

describe('analytics: sleep across date boundaries', () => {
  const w: DayWindow = { startKey: '2026-10-15', endKey: '2026-10-17' };
  it('attributes sleep to the local day it started', () => {
    const s = summarizeSleep(
      [
        ev('sleep', '2026-10-15T19:00:00Z', { durationMin: 480 }), // night start
        ev('sleep', '2026-10-16T10:00:00Z', { durationMin: 90 }), // nap
      ],
      w,
      BABY.id
    );
    expect(s.nightMin).toBe(480);
    expect(s.napMin).toBe(90);
    expect(s.totalMin).toBe(570);
    const day15 = s.byDay.find((d) => d.date === '2026-10-15');
    expect(day15?.minutes).toBe(480);
  });
  it('fills empty days with zero rather than interpolating', () => {
    const s = summarizeSleep([ev('sleep', '2026-10-15T19:00:00Z', { durationMin: 300 })], w, BABY.id);
    expect(s.byDay).toHaveLength(3);
    expect(s.byDay[1].minutes).toBe(0);
    expect(s.byDay[2].minutes).toBe(0);
  });
});

describe('analytics: diapers and tummy time', () => {
  const w: DayWindow = { startKey: '2026-10-15', endKey: '2026-10-17' };
  it('counts categories', () => {
    const s = summarizeDiapers(
      [
        ev('diaper', '2026-10-15T09:00:00Z', { diaperType: 'wet' }),
        ev('diaper', '2026-10-15T13:00:00Z', { diaperType: 'dirty' }),
        ev('diaper', '2026-10-16T13:00:00Z', { diaperType: 'both' }),
      ],
      w,
      BABY.id
    );
    expect(s).toEqual({ total: 3, wet: 1, dirty: 1, both: 1 });
  });
  it('sums tummy time', () => {
    const s = summarizeTummyTime(
      [
        ev('tummy_time', '2026-10-15T09:00:00Z', { durationMin: 5 }),
        ev('tummy_time', '2026-10-16T09:00:00Z', { durationMin: 8 }),
      ],
      w,
      BABY.id
    );
    expect(s).toEqual({ totalMin: 13, sessionCount: 2 });
  });
});

describe('analytics: activity overview and windows', () => {
  it('lastNDays produces an inclusive window ending today', () => {
    const w = lastNDays(7, NOW);
    expect(w.endKey).toBe('2026-10-17');
    expect(w.startKey).toBe('2026-10-11');
  });
  it('activityByDay covers every day of the window', () => {
    const w = lastNDays(7, NOW);
    const days = activityByDay(
      [ev('diaper', '2026-10-15T09:00:00Z', { diaperType: 'wet' })],
      w,
      BABY.id
    );
    expect(days).toHaveLength(7);
    const d15 = days.find((d) => d.date === '2026-10-15');
    expect(d15?.diapers).toBe(1);
  });
  it('histories are scoped and sorted', () => {
    const g = growthHistory(
      [
        { id: crypto.randomUUID(), babyId: BABY.id, date: '2026-10-05', weightGrams: 4300 },
        { id: crypto.randomUUID(), babyId: BABY.id, date: '2026-09-01', weightGrams: 4000 },
      ],
      BABY.id
    );
    expect(g[0].date).toBe('2026-09-01');
    expect(milestoneTimeline([], BABY.id)).toEqual([]);
  });
});

describe('CSV export', () => {
  it('escapes commas, quotes and newlines per RFC 4180', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('has,comma')).toBe('"has,comma"');
    expect(csvEscape('has"quote')).toBe('"has""quote"');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(42)).toBe('42');
  });
  it('produces CRLF rows with a header', () => {
    const csv = eventsToCsv([
      ev('feed_bottle', '2026-10-15T09:00:00Z', { amountMl: 60, milkType: 'formula', note: 'note, with comma' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('id,baby_id,type,timestamp_utc,local_date,detail,note');
    expect(lines[1]).toContain('feed_bottle');
    expect(lines[1]).toContain('"note, with comma"');
    expect(lines[1]).toContain('amountMl=60');
  });
  it('round-trips a quoted field without breaking columns', () => {
    const csv = eventsToCsv([ev('note', '2026-10-15T09:00:00Z', { note: 'He said "more"' })]);
    const detailCol = csv.split('\r\n')[1];
    expect(detailCol).toContain('"He said ""more"""');
  });
});

describe('backup: dry-run validation', () => {
  it('rejects invalid JSON without throwing', () => {
    const r = dryRunParse('{not json');
    expect(r.dryRun.ok).toBe(false);
    expect(r.dryRun.issues[0].message).toContain('not valid JSON');
  });
  it('rejects foreign files', () => {
    const r = dryRunParse(JSON.stringify({ app: 'Other', data: { babies: [], events: [] } }));
    expect(r.dryRun.ok).toBe(false);
  });
  it('flags newer backup versions', () => {
    const r = dryRunParse(
      JSON.stringify({ app: 'NinniNest', backupVersion: BACKUP_VERSION + 1, data: { babies: [], events: [] } })
    );
    expect(r.dryRun.ok).toBe(false);
    expect(r.dryRun.issues.some((i) => i.message.includes('newer'))).toBe(true);
  });
  it('validates full records and reports counts', () => {
    const backup = buildBackup({
      ...emptyAppData(),
      babies: [BABY],
      events: [ev('feed_bottle', '2026-10-15T09:00:00Z', { amountMl: 60, milkType: 'formula' })],
    });
    const r = dryRunParse(JSON.stringify(backup));
    expect(r.dryRun.ok).toBe(true);
    expect(r.dryRun.counts.babies).toBe(1);
    expect(r.dryRun.counts.events).toBe(1);
  });
  it('drops malformed records and warns', () => {
    const backup = buildBackup({
      ...emptyAppData(),
      babies: [BABY],
      events: [
        ev('feed_bottle', '2026-10-15T09:00:00Z', { amountMl: 60, milkType: 'formula' }),
        { id: 'bad-id', babyId: BABY.id, type: 'feed_bottle', amountMl: -5, milkType: 'x' },
      ],
    } as AppData);
    const r = dryRunParse(JSON.stringify(backup));
    expect(r.dryRun.counts.events).toBe(1);
    expect(r.dryRun.issues.some((i) => i.message.includes('could not be read'))).toBe(true);
  });
  it('detects duplicate event ids inside the file', () => {
    const dup = ev('note', '2026-10-15T09:00:00Z', { note: 'x' });
    const backup = buildBackup({
      ...emptyAppData(),
      babies: [BABY],
      events: [dup, { ...dup }],
    });
    const r = dryRunParse(JSON.stringify(backup));
    expect(r.dryRun.duplicateEventIds).toHaveLength(1);
  });
});

describe('backup: merge vs replace semantics', () => {
  const current = emptyAppData();
  current.babies = [BABY];
  current.events = [ev('note', '2026-10-10T09:00:00Z', { note: 'existing', id: 'e0000000-0000-4000-8000-0000000000e1' })];
  const incoming = emptyAppData();
  incoming.babies = [BABY];
  incoming.events = [
    ev('note', '2026-10-12T09:00:00Z', { note: 'new', id: 'e0000000-0000-4000-8000-0000000000e2' }),
    ev('note', '2026-10-10T09:00:00Z', { note: 'existing', id: 'e0000000-0000-4000-8000-0000000000e1' }),
  ];
  it('merge keeps existing and adds only new ids (no duplicates)', () => {
    const merged = mergeData(current, incoming);
    expect(merged.events).toHaveLength(2);
    expect(merged.events.map((e) => e.id)).toContain('e0000000-0000-4000-8000-0000000000e2');
  });
  it('merge never loses a baby even if incoming is empty', () => {
    const merged = mergeData(current, emptyAppData());
    expect(merged.babies).toHaveLength(1);
  });
});

function emptyAppData(): AppData {
  return {
    babies: [], events: [], activeTimers: [], growthRecords: [], milestones: [],
    medications: [], medicationAdministrations: [], vaccinations: [], routines: [],
    schemaVersion: 3,
  };
}

describe('multi-baby isolation in analytics', () => {
  const OTHER = 'b0000000-0000-4000-8000-000000000002';
  const w: DayWindow = { startKey: '2026-10-15', endKey: '2026-10-17' };
  it('summaries never cross babies', () => {
    const s = summarizeDiapers(
      [
        ev('diaper', '2026-10-15T09:00:00Z', { diaperType: 'wet' }),
        ev('diaper', '2026-10-15T10:00:00Z', { diaperType: 'dirty', babyId: OTHER }),
      ],
      w,
      BABY.id
    );
    expect(s.total).toBe(1);
  });
});
