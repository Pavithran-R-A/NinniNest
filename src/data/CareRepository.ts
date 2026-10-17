import type { ActiveTimer, AppData, Baby, CareEvent } from '../models/types';

export interface CareRepository {
  init(): Promise<void>;
  loadAll(): Promise<AppData>;
  addBaby(baby: Baby): Promise<void>;
  updateBaby(baby: Baby): Promise<void>;
  deleteBaby(babyId: string): Promise<void>;
  addEvent(event: CareEvent): Promise<void>;
  updateEvent(event: CareEvent): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  addTimer(timer: ActiveTimer): Promise<void>;
  deleteTimer(timerId: string): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
  close(): Promise<void>;
}
