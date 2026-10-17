import type { GrowthRecord } from './types';
import { GRAMS_PER_LB, CM_PER_IN } from './types';

export function gramsToLb(grams: number): number {
  return grams / GRAMS_PER_LB;
}

export function lbToGrams(lb: number): number {
  return lb * GRAMS_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function formatWeight(grams: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const lb = gramsToLb(grams);
    const oz = (lb - Math.floor(lb)) * 16;
    return `${Math.floor(lb)} lb ${Math.round(oz)} oz`;
  }
  if (grams < 10000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${(grams / 1000).toFixed(1)} kg`;
}

export function formatLength(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${cmToIn(cm).toFixed(1)} in`;
  return `${cm.toFixed(1)} cm`;
}

export function ageInDays(birthDate: string, onDate: string): number {
  const b = new Date(birthDate + 'T00:00:00').getTime();
  const d = new Date(onDate + 'T00:00:00').getTime();
  return Math.round((d - b) / 86400000);
}

export interface TrendPoint {
  date: string;
  ageDays: number;
  value: number;
}

export function buildTrend(
  records: GrowthRecord[],
  pick: (r: GrowthRecord) => number | undefined,
  birthDate: string
): TrendPoint[] {
  return records
    .map((r) => ({ record: r, value: pick(r) }))
    .filter((x): x is { record: GrowthRecord; value: number } => x.value !== undefined)
    .map(({ record, value }) => ({
      date: record.date,
      ageDays: ageInDays(birthDate, record.date),
      value,
    }))
    .sort((a, b) => a.ageDays - b.ageDays);
}

export function describeTrend(points: TrendPoint[]): string {
  if (points.length === 0) return 'No measurements yet';
  if (points.length === 1) return 'One measurement so far — a trend appears with more';
  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = last.ageDays - first.ageDays;
  if (spanDays <= 0) return 'Measurements on the same day';
  const perDay = (last.value - first.value) / spanDays;
  return `Change: ${perDay >= 0 ? '+' : ''}${perDay.toFixed(1)} per day across ${spanDays} days`;
}
