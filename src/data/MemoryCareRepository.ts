import type {
  ActiveTimer, AppData, Baby, CareEvent, GrowthRecord, MedicationAdministration,
  MedicationRecord, MilestoneRecord, RoutineTemplate, VaccinationRecord,
} from '../models/types';
import type { CareRepository } from './CareRepository';

// Two isolated realms: personal storage and demo storage. Demo mode swaps which
// realm the adapter reads and writes — personal rows are never mutated while
// demo mode is active. Passing the same `shared` object to a second instance
// simulates an app restart over persisted storage in tests.
export interface MemoryRealms {
  personal?: AppData;
  demo?: AppData;
}

const EMPTY: AppData = {
  babies: [], events: [], activeTimers: [], growthRecords: [], milestones: [],
  medications: [], medicationAdministrations: [], vaccinations: [], routines: [],
  schemaVersion: 3,
};

function clone(d: AppData): AppData {
  return JSON.parse(JSON.stringify(d)) as AppData;
}

export class MemoryCareRepository implements CareRepository {
  callOrder: string[] = [];
  failNextReplace = false;
  failNextDeleteTimer = false;

  private realms: MemoryRealms;
  private demoMode = false;
  private realmData: AppData;

  constructor(shared?: MemoryRealms) {
    this.realms = shared ?? {};
    if (!this.realms.personal) this.realms.personal = clone(EMPTY);
    if (!this.realms.demo) this.realms.demo = clone(EMPTY);
    this.realmData = this.realms.personal;
  }

  private realm(): AppData {
    return this.demoMode ? this.realms.demo! : this.realms.personal!;
  }

  get data(): AppData {
    return this.realmData;
  }

  async init(): Promise<void> {
    this.realmData = this.realm();
  }
  async close(): Promise<void> {}

  async loadAll(): Promise<AppData> {
    return clone(this.realmData);
  }

  async addBaby(baby: Baby): Promise<void> {
    this.callOrder.push(`baby:${baby.id}`);
    this.realmData.babies = [...this.realmData.babies.filter((b) => b.id !== baby.id), baby];
  }
  async updateBaby(baby: Baby): Promise<void> { await this.addBaby(baby); }
  async deleteBaby(babyId: string): Promise<void> {
    this.callOrder.push(`deleteBaby:${babyId}`);
    this.realmData.babies = this.realmData.babies.filter((b) => b.id !== babyId);
  }

  async addEvent(event: CareEvent): Promise<void> {
    this.callOrder.push(`event:${event.id}`);
    this.realmData.events = [...this.realmData.events.filter((e) => e.id !== event.id), event];
  }
  async updateEvent(event: CareEvent): Promise<void> { await this.addEvent(event); }
  async deleteEvent(eventId: string): Promise<void> {
    this.callOrder.push(`deleteEvent:${eventId}`);
    this.realmData.events = this.realmData.events.filter((e) => e.id !== eventId);
  }

  async addTimer(timer: ActiveTimer): Promise<void> {
    this.callOrder.push(`timer:${timer.id}`);
    this.realmData.activeTimers = [...this.realmData.activeTimers.filter((t) => t.id !== timer.id), timer];
  }
  async deleteTimer(timerId: string): Promise<void> {
    this.callOrder.push(`deleteTimer:${timerId}`);
    if (this.failNextDeleteTimer) {
      this.failNextDeleteTimer = false;
      throw new Error('simulated deleteTimer failure');
    }
    this.realmData.activeTimers = this.realmData.activeTimers.filter((t) => t.id !== timerId);
  }

  async addGrowthRecord(record: GrowthRecord): Promise<void> { this.upsert('growthRecords', record); }
  async deleteGrowthRecord(id: string): Promise<void> { this.realmData.growthRecords = this.realmData.growthRecords.filter((x) => x.id !== id); }
  async addMilestone(record: MilestoneRecord): Promise<void> { this.upsert('milestones', record); }
  async deleteMilestone(id: string): Promise<void> { this.realmData.milestones = this.realmData.milestones.filter((x) => x.id !== id); }
  async addMedication(record: MedicationRecord): Promise<void> { this.upsert('medications', record); }
  async deleteMedication(id: string): Promise<void> { this.realmData.medications = this.realmData.medications.filter((x) => x.id !== id); }
  async addMedicationAdministration(record: MedicationAdministration): Promise<void> { this.upsert('medicationAdministrations', record); }
  async deleteMedicationAdministration(id: string): Promise<void> { this.realmData.medicationAdministrations = this.realmData.medicationAdministrations.filter((x) => x.id !== id); }
  async addVaccination(record: VaccinationRecord): Promise<void> { this.upsert('vaccinations', record); }
  async deleteVaccination(id: string): Promise<void> { this.realmData.vaccinations = this.realmData.vaccinations.filter((x) => x.id !== id); }
  async addRoutine(record: RoutineTemplate): Promise<void> { this.upsert('routines', record); }
  async deleteRoutine(id: string): Promise<void> { this.realmData.routines = this.realmData.routines.filter((x) => x.id !== id); }

  private upsert(key: keyof AppData, item: { id: string }): void {
    const arr = this.realmData[key] as unknown as { id: string }[];
    const i = arr.findIndex((x) => x.id === item.id);
    if (i >= 0) arr[i] = item;
    else arr.push(item);
  }

  async replaceAll(data: AppData): Promise<void> {
    this.callOrder.push('replaceAll');
    if (this.failNextReplace) {
      this.failNextReplace = false;
      throw new Error('simulated replaceAll failure');
    }
    const clean = clone({ ...data, schemaVersion: 3 });
    this.realmData.babies = clean.babies;
    this.realmData.events = clean.events;
    this.realmData.activeTimers = clean.activeTimers;
    this.realmData.growthRecords = clean.growthRecords;
    this.realmData.milestones = clean.milestones;
    this.realmData.medications = clean.medications;
    this.realmData.medicationAdministrations = clean.medicationAdministrations;
    this.realmData.vaccinations = clean.vaccinations;
    this.realmData.routines = clean.routines;
  }

  // Swaps between the personal and demo realms. Personal rows are never read
  // or written while demo mode is active.
  async setDemoMode(on: boolean): Promise<void> {
    if (this.demoMode === on) return;
    this.demoMode = on;
    this.callOrder.push(on ? 'demo:on' : 'demo:off');
    this.realmData = this.realm();
  }
}
