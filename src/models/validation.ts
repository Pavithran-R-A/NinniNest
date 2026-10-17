import { z } from 'zod';
import { isCalendarValid } from './calendar';
import type {
  ActiveTimer, AppData, Baby, CareEvent, GrowthRecord, MedicationAdministration,
  MedicationRecord, MilestoneRecord, RoutineTemplate, VaccinationRecord,
} from './types';

export const idSchema = z.string().uuid();
export const isoSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date');
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarValid, 'not a real calendar date');
export const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const babySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(40),
  birthDate: dateKeySchema,
  createdAt: isoSchema,
  photoUri: z.string().max(500000).optional(),
  preferredUnits: z.enum(['metric', 'imperial']).optional(),
  isDemo: z.boolean().optional(),
});

const baseEventShape = {
  id: idSchema,
  babyId: idSchema,
  timestamp: isoSchema,
  note: z.string().max(500).optional(),
  isDemo: z.boolean().optional(),
};

export const careEventSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseEventShape,
    type: z.literal('feed_bottle'),
    amountMl: z.number().min(0).max(2000),
    milkType: z.enum(['breast_milk', 'formula', 'mixed']),
  }),
  z.object({
    ...baseEventShape,
    type: z.literal('feed_breast'),
    durationMin: z.number().min(0).max(240),
    side: z.enum(['left', 'right', 'both']),
  }),
  z.object({
    ...baseEventShape,
    type: z.literal('feed_solids'),
    foodDescription: z.string().min(1).max(200),
    reaction: z.enum(['liked', 'neutral', 'refused']).optional(),
  }),
  z.object({
    ...baseEventShape,
    type: z.literal('diaper'),
    diaperType: z.enum(['wet', 'dirty', 'both']),
  }),
  z.object({
    ...baseEventShape,
    type: z.literal('sleep'),
    durationMin: z.number().min(0).max(1440),
  }),
  z.object({
    ...baseEventShape,
    type: z.literal('pump'),
    amountMl: z.number().min(0).max(2000),
    durationMin: z.number().min(0).max(240),
    side: z.enum(['left', 'right', 'both']).optional(),
  }),
  z.object({
    ...baseEventShape,
    type: z.literal('tummy_time'),
    durationMin: z.number().min(0).max(240),
  }),
  z.object({
    ...baseEventShape,
    type: z.literal('note'),
    note: z.string().min(1).max(500),
  }),
]);

const timerSegmentSchema = z.object({
  start: isoSchema,
  end: isoSchema.nullable(),
});

export const activeTimerSchema = z.object({
  id: idSchema,
  babyId: idSchema,
  kind: z.enum(['feed_breast', 'sleep', 'tummy_time', 'pump']),
  startedAt: isoSchema,
  side: z.enum(['left', 'right', 'both']).optional(),
  segments: z.array(timerSegmentSchema).min(1),
  lastSide: z.enum(['left', 'right', 'both']).optional(),
  isDemo: z.boolean().optional(),
});

export const growthRecordSchema = z
  .object({
    id: idSchema,
    babyId: idSchema,
    date: dateKeySchema,
    weightGrams: z.number().min(250).max(25000).optional(),
    heightCm: z.number().min(20).max(200).optional(),
    headCircumferenceCm: z.number().min(20).max(60).optional(),
    note: z.string().max(500).optional(),
    isDemo: z.boolean().optional(),
  })
  .refine(
    (r) => r.weightGrams !== undefined || r.heightCm !== undefined || r.headCircumferenceCm !== undefined,
    'at least one measurement is required'
  );

export const milestoneRecordSchema = z.object({
  id: idSchema,
  babyId: idSchema,
  category: z.enum(['motor', 'social', 'language', 'cognitive', 'feeding', 'custom']),
  title: z.string().min(1).max(120),
  date: dateKeySchema,
  note: z.string().max(500).optional(),
  photoUri: z.string().max(2000000).optional(),
  isDemo: z.boolean().optional(),
});

export const medicationRecordSchema = z.object({
  id: idSchema,
  babyId: idSchema,
  name: z.string().min(1).max(80),
  instructions: z.string().max(500).optional(),
  doseAmount: z.number().min(0).max(1000).optional(),
  doseUnit: z.enum(['ml', 'mg', 'drops', 'tablets']).optional(),
  notes: z.string().max(500).optional(),
  isDemo: z.boolean().optional(),
});

export const medicationAdministrationSchema = z.object({
  id: idSchema,
  babyId: idSchema,
  medicationId: idSchema,
  timestamp: isoSchema,
  doseAmount: z.number().min(0).max(1000).optional(),
  doseUnit: z.enum(['ml', 'mg', 'drops', 'tablets']).optional(),
  note: z.string().max(500).optional(),
  isDemo: z.boolean().optional(),
});

export const vaccinationRecordSchema = z.object({
  id: idSchema,
  babyId: idSchema,
  name: z.string().min(1).max(120),
  dateGiven: dateKeySchema,
  nextAppointment: dateKeySchema.optional(),
  provider: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  isDemo: z.boolean().optional(),
});

export const routineTemplateSchema = z.object({
  id: idSchema,
  babyId: idSchema,
  title: z.string().min(1).max(80),
  kind: z.enum(['feed', 'nap', 'pump', 'tummy_time', 'reminder']),
  timeOfDay: hhmmSchema,
  days: z.array(z.number().int().min(0).max(6)).max(7),
  active: z.boolean(),
  isDemo: z.boolean().optional(),
});

export const appDataSchema = z.object({
  babies: z.array(z.unknown()),
  events: z.array(z.unknown()),
  activeTimers: z.array(z.unknown()),
  growthRecords: z.array(z.unknown()).optional(),
  milestones: z.array(z.unknown()).optional(),
  medications: z.array(z.unknown()).optional(),
  medicationAdministrations: z.array(z.unknown()).optional(),
  vaccinations: z.array(z.unknown()).optional(),
  routines: z.array(z.unknown()).optional(),
  schemaVersion: z.number(),
});

export function validateBaby(b: unknown): Baby | null {
  const r = babySchema.safeParse(b);
  return r.success ? r.data : null;
}

export function validateEvent(e: unknown): CareEvent | null {
  const r = careEventSchema.safeParse(e);
  return r.success ? r.data : null;
}

export function validateTimer(t: unknown): ActiveTimer | null {
  const r = activeTimerSchema.safeParse(t);
  return r.success ? r.data : null;
}

export function validateGrowth(r: unknown): GrowthRecord | null {
  const res = growthRecordSchema.safeParse(r);
  return res.success ? res.data : null;
}

export function validateMilestone(m: unknown): MilestoneRecord | null {
  const res = milestoneRecordSchema.safeParse(m);
  return res.success ? res.data : null;
}

export function validateMedication(m: unknown): MedicationRecord | null {
  const res = medicationRecordSchema.safeParse(m);
  return res.success ? res.data : null;
}

export function validateMedicationAdministration(a: unknown): MedicationAdministration | null {
  const res = medicationAdministrationSchema.safeParse(a);
  return res.success ? res.data : null;
}

export function validateVaccination(v: unknown): VaccinationRecord | null {
  const res = vaccinationRecordSchema.safeParse(v);
  return res.success ? res.data : null;
}

export function validateRoutine(r: unknown): RoutineTemplate | null {
  const res = routineTemplateSchema.safeParse(r);
  return res.success ? res.data : null;
}
