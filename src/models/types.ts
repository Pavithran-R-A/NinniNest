export interface Baby {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  createdAt: string; // ISO UTC
  photoUri?: string;
  preferredUnits?: 'metric' | 'imperial';
  isDemo?: boolean;
}

export type EventType =
  | 'feed_bottle'
  | 'feed_breast'
  | 'feed_solids'
  | 'diaper'
  | 'sleep'
  | 'pump'
  | 'tummy_time'
  | 'note';

export type MilkType = 'breast_milk' | 'formula' | 'mixed';
export type BreastSide = 'left' | 'right' | 'both';
export type DiaperType = 'wet' | 'dirty' | 'both';

export interface CareEventBase {
  id: string;
  babyId: string;
  type: EventType;
  timestamp: string; // ISO UTC
  note?: string;
  isDemo?: boolean;
}

export interface BottleEvent extends CareEventBase {
  type: 'feed_bottle';
  amountMl: number;
  milkType: MilkType;
}

export interface BreastFeedEvent extends CareEventBase {
  type: 'feed_breast';
  durationMin: number;
  side: BreastSide;
}

export interface SolidsEvent extends CareEventBase {
  type: 'feed_solids';
  foodDescription: string;
  reaction?: 'liked' | 'neutral' | 'refused';
}

export interface DiaperEvent extends CareEventBase {
  type: 'diaper';
  diaperType: DiaperType;
}

export interface SleepEvent extends CareEventBase {
  type: 'sleep';
  durationMin: number;
}

export interface PumpEvent extends CareEventBase {
  type: 'pump';
  amountMl: number;
  durationMin: number;
  side?: BreastSide;
}

export interface TummyTimeEvent extends CareEventBase {
  type: 'tummy_time';
  durationMin: number;
}

export interface NoteEvent extends CareEventBase {
  type: 'note';
  note: string;
}

export type CareEvent =
  | BottleEvent
  | BreastFeedEvent
  | SolidsEvent
  | DiaperEvent
  | SleepEvent
  | PumpEvent
  | TummyTimeEvent
  | NoteEvent;

export type TimerKind = 'feed_breast' | 'sleep' | 'tummy_time' | 'pump';

export interface TimerSegment {
  start: string; // ISO UTC
  end: string | null; // null = currently running
}

export interface ActiveTimer {
  id: string;
  babyId: string;
  kind: TimerKind;
  startedAt: string; // ISO UTC (first segment start)
  side?: BreastSide;
  segments: TimerSegment[]; // completed + running segments
  lastSide?: BreastSide; // last-used side memory for breastfeeding
  isDemo?: boolean;
}

// ---- Phase C ----

// Canonical: grams + cm. lb/oz and in are display-only.
export interface GrowthRecord {
  id: string;
  babyId: string;
  date: string; // YYYY-MM-DD
  weightGrams?: number; // 250–25000
  heightCm?: number; // 20–200
  headCircumferenceCm?: number; // 20–60
  note?: string;
  isDemo?: boolean;
}

export type MilestoneCategory =
  | 'motor'
  | 'social'
  | 'language'
  | 'cognitive'
  | 'feeding'
  | 'custom';

export interface MilestoneRecord {
  id: string;
  babyId: string;
  category: MilestoneCategory;
  title: string;
  date: string; // YYYY-MM-DD (may be approximate)
  note?: string;
  photoUri?: string; // app-managed file on native; data URL on web
  isDemo?: boolean;
}

export interface MedicationRecord {
  id: string;
  babyId: string;
  name: string; // user-entered
  instructions?: string; // user-entered prescription text; never generated
  doseAmount?: number;
  doseUnit?: 'ml' | 'mg' | 'drops' | 'tablets';
  notes?: string;
  isDemo?: boolean;
}

export interface MedicationAdministration {
  id: string;
  babyId: string;
  medicationId: string;
  timestamp: string; // ISO UTC
  doseAmount?: number;
  doseUnit?: 'ml' | 'mg' | 'drops' | 'tablets';
  note?: string;
  isDemo?: boolean;
}

export interface VaccinationRecord {
  id: string;
  babyId: string;
  name: string;
  dateGiven: string; // YYYY-MM-DD
  nextAppointment?: string; // YYYY-MM-DD
  provider?: string;
  notes?: string;
  isDemo?: boolean;
}

export type RoutineKind = 'feed' | 'nap' | 'pump' | 'tummy_time' | 'reminder';

export interface RoutineTemplate {
  id: string;
  babyId: string;
  title: string;
  kind: RoutineKind;
  timeOfDay: string; // "HH:mm" local
  days: number[]; // 0=Sunday..6=Saturday
  active: boolean;
  isDemo?: boolean;
}

export interface AppData {
  babies: Baby[];
  events: CareEvent[];
  activeTimers: ActiveTimer[];
  growthRecords: GrowthRecord[];
  milestones: MilestoneRecord[];
  medications: MedicationRecord[];
  medicationAdministrations: MedicationAdministration[];
  vaccinations: VaccinationRecord[];
  routines: RoutineTemplate[];
  schemaVersion: 3;
}

export const GRAMS_PER_LB = 453.592;
export const CM_PER_IN = 2.54;
