// Strict calendar validation: "2026-02-30" is not a real date even though the
// string matches YYYY-MM-DD, and new Date("2026-02-30") silently rolls over.
export function isCalendarValid(dateKey: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2100) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// A birth date must be a real calendar date that is not in the future and not
// absurdly far in the past.
export function isValidBirthDate(dateKey: string, now: Date = new Date()): boolean {
  if (!isCalendarValid(dateKey)) return false;
  const today = localKeyOf(now);
  if (dateKey > today) return false;
  return dateKey >= '1900-01-01';
}

export function localKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(aKey: string, bKey: string): number {
  const a = Date.UTC(
    Number(aKey.slice(0, 4)), Number(aKey.slice(5, 7)) - 1, Number(aKey.slice(8, 10))
  );
  const b = Date.UTC(
    Number(bKey.slice(0, 4)), Number(bKey.slice(5, 7)) - 1, Number(bKey.slice(8, 10))
  );
  return Math.round((b - a) / 86400000);
}

export function addDays(key: string, n: number): string {
  const d = new Date(
    key + 'T00:00:00'
  );
  d.setDate(d.getDate() + n);
  return localKeyOf(d);
}
