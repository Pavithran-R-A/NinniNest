import type { ActiveTimer, AppData, Baby, CareEvent } from '../models/types';
import type { CareRepository } from './CareRepository';

const DB_NAME = 'ninninest-web';
const STORE = 'kv';

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
    const data = await get<AppData>(db, 'appData');
    return data ?? { babies: [], events: [], activeTimers: [], schemaVersion: 1 };
  }

  private async saveAll(mutator: (data: AppData) => void): Promise<void> {
    const db = this.assert();
    const data = await this.loadAll();
    mutator(data);
    await put(db, 'appData', data);
  }

  async addBaby(baby: Baby): Promise<void> {
    await this.saveAll((d) => {
      const i = d.babies.findIndex((b) => b.id === baby.id);
      if (i >= 0) d.babies[i] = baby;
      else d.babies.push(baby);
    });
  }

  async updateBaby(baby: Baby): Promise<void> {
    return this.addBaby(baby);
  }

  async deleteBaby(babyId: string): Promise<void> {
    await this.saveAll((d) => {
      d.babies = d.babies.filter((b) => b.id !== babyId);
      d.events = d.events.filter((e) => e.babyId !== babyId);
      d.activeTimers = d.activeTimers.filter((t) => t.babyId !== babyId);
    });
  }

  async addEvent(event: CareEvent): Promise<void> {
    await this.saveAll((d) => {
      const i = d.events.findIndex((e) => e.id === event.id);
      if (i >= 0) d.events[i] = event;
      else d.events.push(event);
    });
  }

  async updateEvent(event: CareEvent): Promise<void> {
    return this.addEvent(event);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.saveAll((d) => {
      d.events = d.events.filter((e) => e.id !== eventId);
    });
  }

  async addTimer(timer: ActiveTimer): Promise<void> {
    await this.saveAll((d) => {
      const i = d.activeTimers.findIndex((t) => t.id === timer.id);
      if (i >= 0) d.activeTimers[i] = timer;
      else d.activeTimers.push(timer);
    });
  }

  async deleteTimer(timerId: string): Promise<void> {
    await this.saveAll((d) => {
      d.activeTimers = d.activeTimers.filter((t) => t.id !== timerId);
    });
  }

  async replaceAll(data: AppData): Promise<void> {
    await put(this.assert(), 'appData', data);
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}
