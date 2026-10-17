export interface Baby {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  createdAt: string; // ISO UTC
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

export interface ActiveTimer {
  id: string;
  babyId: string;
  kind: 'feed_breast' | 'sleep' | 'tummy_time' | 'pump';
  startedAt: string; // ISO UTC
  side?: BreastSide;
  isDemo?: boolean;
}

export interface AppData {
  babies: Baby[];
  events: CareEvent[];
  activeTimers: ActiveTimer[];
  schemaVersion: 1;
}
