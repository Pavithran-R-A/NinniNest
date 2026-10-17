import { z } from 'zod';
import type { ActiveTimer, Baby, CareEvent } from './types';

export const idSchema = z.string().uuid();
export const isoSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date');

export const babySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(40),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: isoSchema,
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

export const activeTimerSchema = z.object({
  id: idSchema,
  babyId: idSchema,
  kind: z.enum(['feed_breast', 'sleep', 'tummy_time', 'pump']),
  startedAt: isoSchema,
  side: z.enum(['left', 'right', 'both']).optional(),
  isDemo: z.boolean().optional(),
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
