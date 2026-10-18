import type {
  ActiveTimer, AppData, Baby, CareEvent, GrowthRecord, MedicationAdministration,
  MedicationRecord, MilestoneRecord, RoutineTemplate, VaccinationRecord,
} from '../models/types';

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
  // Phase C
  addGrowthRecord(record: GrowthRecord): Promise<void>;
  deleteGrowthRecord(id: string): Promise<void>;
  addMilestone(record: MilestoneRecord): Promise<void>;
  deleteMilestone(id: string): Promise<void>;
  addMedication(record: MedicationRecord): Promise<void>;
  deleteMedication(id: string): Promise<void>;
  addMedicationAdministration(record: MedicationAdministration): Promise<void>;
  deleteMedicationAdministration(id: string): Promise<void>;
  addVaccination(record: VaccinationRecord): Promise<void>;
  deleteVaccination(id: string): Promise<void>;
  addRoutine(record: RoutineTemplate): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
  close(): Promise<void>;
  // Demo isolation: swaps the adapter between personal storage and a separate
  // demo storage realm. Personal rows must never be readable or writable while
  // demo mode is active, and must survive entry, exit and restart untouched.
  setDemoMode(on: boolean): Promise<void>;
}
