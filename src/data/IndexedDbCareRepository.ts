import type {
  ActiveTimer, AppData, Baby, CareEvent, GrowthRecord, MedicationAdministration,
  MedicationRecord, MilestoneRecord, RoutineTemplate, VaccinationRecord,
} from '../models/types';
import type { CareRepository } from './CareRepository';

const DB_NAME = 'ninninest-web';
const STORE = 'kv';
const APP_KEY = 'appData';
const DEMO_KEY = 'demoData';
const DEMO_FLAG_KEY = 'demoActive';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function put(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
}

function get<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
  });
}

const EMPTY_V3: AppData = {
  babies: [], events: [], activeTimers: [], growthRecords: [], milestones: [],
  medications: [], medicationAdministrations: [], vaccinations: [], routines: [],
  schemaVersion: 3,
};

export class IndexedDbCareRepository implements CareRepository {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDb();
  }

  private assert(): IDBDatabase {
    if (!this.db) throw new Error('repository not initialised');
    return this.db;
  }

  async loadAll(): Promise<AppData> {
    const db = this.assert();
    const key = (await get<number>(db, DEMO_FLAG_KEY)) === 1 ? DEMO_KEY : APP_KEY;
    const data = await get<Partial<AppData>>(db, key);
    if (!data) return { ...EMPTY_V3 };
    // v1/v2 web data (missing Phase C arrays) upgrades in place to v3.
    return {
      babies: data.babies ?? [],
      events: data.events ?? [],
      activeTimers: data.activeTimers ?? [],
      growthRecords: data.growthRecords ?? [],
      milestones: data.milestones ?? [],
      medications: data.medications ?? [],
      medicationAdministrations: data.medicationAdministrations ?? [],
      vaccinations: data.vaccinations ?? [],
      routines: data.routines ?? [],
      schemaVersion: 3,
    };
  }

  private async saveAll(mutator: (data: AppData) => void): Promise<void> {
    const db = this.assert();
    const data = await this.loadAll();
    mutator(data);
    await put(db, (await get<number>(db, DEMO_FLAG_KEY)) === 1 ? DEMO_KEY : APP_KEY, data);
  }

  private async upsert<T extends { id: string }>(
    list: keyof AppData, item: T
  ): Promise<void> {
    await this.saveAll((d) => {
      const arr = d[list] as unknown as T[];
      const i = arr.findIndex((x) => x.id === item.id);
      if (i >= 0) arr[i] = item;
      else arr.push(item);
    });
  }

  private async removeById(list: keyof AppData, id: string): Promise<void> {
    await this.saveAll((d) => {
      const arr = d[list] as unknown as { id: string }[];
      const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) arr.splice(i, 1);
    });
  }

  async addBaby(baby: Baby): Promise<void> {
    await this.upsert('babies', baby);
  }

  async updateBaby(baby: Baby): Promise<void> {
    return this.addBaby(baby);
  }

  async deleteBaby(babyId: string): Promise<void> {
    await this.saveAll((d) => {
      d.babies = d.babies.filter((b) => b.id !== babyId);
      d.events = d.events.filter((e) => e.babyId !== babyId);
      d.activeTimers = d.activeTimers.filter((t) => t.babyId !== babyId);
      d.growthRecords = d.growthRecords.filter((g) => g.babyId !== babyId);
      d.milestones = d.milestones.filter((m) => m.babyId !== babyId);
      d.medications = d.medications.filter((m) => m.babyId !== babyId);
      d.medicationAdministrations = d.medicationAdministrations.filter((a) => a.babyId !== babyId);
      d.vaccinations = d.vaccinations.filter((v) => v.babyId !== babyId);
      d.routines = d.routines.filter((r) => r.babyId !== babyId);
    });
  }

  async addEvent(event: CareEvent): Promise<void> {
    await this.upsert('events', event);
  }

  async updateEvent(event: CareEvent): Promise<void> {
    return this.addEvent(event);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.removeById('events', eventId);
  }

  async addTimer(timer: ActiveTimer): Promise<void> {
    await this.upsert('activeTimers', timer);
  }

  async deleteTimer(timerId: string): Promise<void> {
    await this.removeById('activeTimers', timerId);
  }

  async addGrowthRecord(record: GrowthRecord): Promise<void> {
    await this.upsert('growthRecords', record);
  }

  async deleteGrowthRecord(id: string): Promise<void> {
    await this.removeById('growthRecords', id);
  }

  async addMilestone(record: MilestoneRecord): Promise<void> {
    await this.upsert('milestones', record);
  }

  async deleteMilestone(id: string): Promise<void> {
    await this.removeById('milestones', id);
  }

  async addMedication(record: MedicationRecord): Promise<void> {
    await this.upsert('medications', record);
  }

  async deleteMedication(id: string): Promise<void> {
    await this.saveAll((d) => {
      d.medications = d.medications.filter((m) => m.id !== id);
      d.medicationAdministrations = d.medicationAdministrations.filter((a) => a.medicationId !== id);
    });
  }

  async addMedicationAdministration(record: MedicationAdministration): Promise<void> {
    await this.upsert('medicationAdministrations', record);
  }

  async deleteMedicationAdministration(id: string): Promise<void> {
    await this.removeById('medicationAdministrations', id);
  }

  async addVaccination(record: VaccinationRecord): Promise<void> {
    await this.upsert('vaccinations', record);
  }

  async deleteVaccination(id: string): Promise<void> {
    await this.removeById('vaccinations', id);
  }

  async addRoutine(record: RoutineTemplate): Promise<void> {
    await this.upsert('routines', record);
  }

  async deleteRoutine(id: string): Promise<void> {
    await this.removeById('routines', id);
  }

  async replaceAll(data: AppData): Promise<void> {
    const db = this.assert();
    const demo = (await get<number>(db, DEMO_FLAG_KEY)) === 1;
    await put(db, demo ? DEMO_KEY : APP_KEY, {
      ...EMPTY_V3,
      ...data,
      schemaVersion: 3,
    });
  }

  // One keyed put is atomic in IndexedDB: the journal event and the timer
  // removal land together or not at all.
  async completeTimerAtomic(event: CareEvent, timerId: string): Promise<void> {
    await this.saveAll((d) => {
      d.events.push(event);
      d.activeTimers = d.activeTimers.filter((t) => t.id !== timerId);
    });
  }

  // Personal rows live under APP_KEY, demo rows under DEMO_KEY. Switching the
  // flag swaps realms; the other realm's bytes are never read or written.
  async setDemoMode(on: boolean): Promise<void> {
    const db = this.assert();
    await put(db, DEMO_FLAG_KEY, on ? 1 : 0);
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}
