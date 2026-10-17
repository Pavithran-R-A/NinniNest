import type { AppData, CareEvent } from './types';
import { localKeyOf } from './calendar';

// RFC 4180: quote fields containing comma, quote, newline; double embedded quotes.
export function csvEscape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells: (string | number | undefined | null)[]): string {
  return cells.map(csvEscape).join(',');
}

const CARE_HEADER = [
  'id', 'baby_id', 'type', 'timestamp_utc', 'local_date', 'detail', 'note',
];

function eventDetail(e: CareEvent): string {
  switch (e.type) {
    case 'feed_bottle':
      return `amountMl=${e.amountMl};milkType=${e.milkType}`;
    case 'feed_breast':
      return `durationMin=${e.durationMin};side=${e.side}`;
    case 'feed_solids':
      return `food=${e.foodDescription};reaction=${e.reaction ?? ''}`;
    case 'diaper':
      return `diaperType=${e.diaperType}`;
    case 'sleep':
      return `durationMin=${e.durationMin}`;
    case 'pump':
      return `amountMl=${e.amountMl};durationMin=${e.durationMin}${e.side ? `;side=${e.side}` : ''}`;
    case 'tummy_time':
      return `durationMin=${e.durationMin}`;
    case 'note':
      return '';
  }
}

function eventNote(e: CareEvent): string {
  return e.note ?? '';
}

export function eventsToCsv(events: CareEvent[], babyId?: string): string {
  const lines = [row(CARE_HEADER)];
  const sorted = events
    .filter((e) => !babyId || e.babyId === babyId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const e of sorted) {
    lines.push(
      row([
        e.id,
        e.babyId,
        e.type,
        e.timestamp,
        localKeyOf(new Date(e.timestamp)),
        eventDetail(e),
        eventNote(e),
      ])
    );
  }
  return lines.join('\r\n') + '\r\n';
}

const GROWTH_HEADER = ['id', 'baby_id', 'date', 'weight_grams', 'height_cm', 'head_cm', 'note'];

export function growthToCsv(data: AppData, babyId?: string): string {
  const lines = [row(GROWTH_HEADER)];
  for (const g of data.growthRecords.filter((g) => !babyId || g.babyId === babyId).sort((a, b) => a.date.localeCompare(b.date))) {
    lines.push(row([g.id, g.babyId, g.date, g.weightGrams, g.heightCm, g.headCircumferenceCm, g.note]));
  }
  return lines.join('\r\n') + '\r\n';
}

const MEDS_HEADER = ['id', 'baby_id', 'medication_id', 'timestamp_utc', 'dose_amount', 'dose_unit', 'note'];

export function medicationsToCsv(data: AppData, babyId?: string): string {
  const lines = [row(MEDS_HEADER)];
  for (const a of data.medicationAdministrations.filter((a) => !babyId || a.babyId === babyId).sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    lines.push(row([a.id, a.babyId, a.medicationId, a.timestamp, a.doseAmount, a.doseUnit, a.note]));
  }
  return lines.join('\r\n') + '\r\n';
}

const VAX_HEADER = ['id', 'baby_id', 'name', 'date_given', 'next_appointment', 'provider', 'notes'];

export function vaccinationsToCsv(data: AppData, babyId?: string): string {
  const lines = [row(VAX_HEADER)];
  for (const v of data.vaccinations.filter((v) => !babyId || v.babyId === babyId).sort((a, b) => a.dateGiven.localeCompare(b.dateGiven))) {
    lines.push(row([v.id, v.babyId, v.name, v.dateGiven, v.nextAppointment, v.provider, v.notes]));
  }
  return lines.join('\r\n') + '\r\n';
}

const MILESTONE_HEADER = ['id', 'baby_id', 'category', 'title', 'date', 'note'];

export function milestonesToCsv(data: AppData, babyId?: string): string {
  const lines = [row(MILESTONE_HEADER)];
  for (const m of data.milestones.filter((m) => !babyId || m.babyId === babyId).sort((a, b) => a.date.localeCompare(b.date))) {
    lines.push(row([m.id, m.babyId, m.category, m.title, m.date, m.note]));
  }
  return lines.join('\r\n') + '\r\n';
}

const ROUTINE_HEADER = ['id', 'baby_id', 'title', 'kind', 'time_of_day', 'days', 'active'];

export function routinesToCsv(data: AppData, babyId?: string): string {
  const lines = [row(ROUTINE_HEADER)];
  for (const r of data.routines.filter((r) => !babyId || r.babyId === babyId)) {
    lines.push(row([r.id, r.babyId, r.title, r.kind, r.timeOfDay, r.days.join(';'), r.active ? 'yes' : 'no']));
  }
  return lines.join('\r\n') + '\r\n';
}

export function allCategoricalCsv(data: AppData, babyId?: string): { name: string; content: string }[] {
  return [
    { name: 'growth', content: growthToCsv(data, babyId) },
    { name: 'medications', content: medicationsToCsv(data, babyId) },
    { name: 'vaccinations', content: vaccinationsToCsv(data, babyId) },
    { name: 'milestones', content: milestonesToCsv(data, babyId) },
    { name: 'routines', content: routinesToCsv(data, babyId) },
  ];
}
