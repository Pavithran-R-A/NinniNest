import * as SQLite from 'expo-sqlite';
import type { ActiveTimer, AppData, Baby, CareEvent } from '../models/types';
import type { CareRepository } from './CareRepository';

const SCHEMA_VERSION = 1;

export class SqliteCareRepository implements CareRepository {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync('ninninest.db');
    await this.db.execAsync('PRAGMA journal_mode = WAL;');
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS babies (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        birthDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        note TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_baby_ts ON events (babyId, timestamp);
      CREATE TABLE IF NOT EXISTS active_timers (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        kind TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        side TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
    `);
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      ['schema_version']
    );
    if (!row) {
      await this.db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', [
        'schema_version',
        String(SCHEMA_VERSION),
      ]);
    }
  }

  async loadAll(): Promise<AppData> {
    if (!this.db) throw new Error('repository not initialised');
    const babies: Baby[] = [];
    const babyRows = await this.db.getAllAsync<{
      id: string; name: string; birthDate: string; createdAt: string; isDemo: number;
    }>('SELECT * FROM babies');
    for (const r of babyRows) {
      babies.push({
        id: r.id, name: r.name, birthDate: r.birthDate, createdAt: r.createdAt,
        isDemo: r.isDemo === 1,
      });
    }
    const events: CareEvent[] = [];
    const eventRows = await this.db.getAllAsync<{ payload: string }>('SELECT payload FROM events');
    for (const r of eventRows) {
      try {
        const parsed = JSON.parse(r.payload) as CareEvent;
        events.push(parsed);
      } catch {
        // skip corrupted row rather than losing the rest of history
      }
    }
    const activeTimers: ActiveTimer[] = [];
    const timerRows = await this.db.getAllAsync<{
      id: string; babyId: string; kind: string; startedAt: string; side: string | null; isDemo: number;
    }>('SELECT * FROM active_timers');
    for (const r of timerRows) {
      activeTimers.push({
        id: r.id, babyId: r.babyId, kind: r.kind as ActiveTimer['kind'],
        startedAt: r.startedAt, side: (r.side ?? undefined) as ActiveTimer['side'],
        isDemo: r.isDemo === 1,
      });
    }
    return { babies, events, activeTimers, schemaVersion: 1 };
  }

  async addBaby(baby: Baby): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync(
      'INSERT OR REPLACE INTO babies (id, name, birthDate, createdAt, isDemo) VALUES (?, ?, ?, ?, ?)',
      [baby.id, baby.name, baby.birthDate, baby.createdAt, baby.isDemo ? 1 : 0]
    );
  }

  async updateBaby(baby: Baby): Promise<void> {
    return this.addBaby(baby);
  }

  async deleteBaby(babyId: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM babies WHERE id = ?', [babyId]);
    await this.db.runAsync('DELETE FROM events WHERE babyId = ?', [babyId]);
    await this.db.runAsync('DELETE FROM active_timers WHERE babyId = ?', [babyId]);
  }

  async addEvent(event: CareEvent): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync(
      'INSERT OR REPLACE INTO events (id, babyId, type, timestamp, note, isDemo, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        event.id, event.babyId, event.type, event.timestamp,
        event.note ?? null, event.isDemo ? 1 : 0, JSON.stringify(event),
      ]
    );
  }

  async updateEvent(event: CareEvent): Promise<void> {
    return this.addEvent(event);
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM events WHERE id = ?', [eventId]);
  }

  async addTimer(timer: ActiveTimer): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync(
      'INSERT OR REPLACE INTO active_timers (id, babyId, kind, startedAt, side, isDemo) VALUES (?, ?, ?, ?, ?, ?)',
      [timer.id, timer.babyId, timer.kind, timer.startedAt, timer.side ?? null, timer.isDemo ? 1 : 0]
    );
  }

  async deleteTimer(timerId: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM active_timers WHERE id = ?', [timerId]);
  }

  async replaceAll(data: AppData): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.withTransactionAsync(async () => {
      await this.db!.runAsync('DELETE FROM babies');
      await this.db!.runAsync('DELETE FROM events');
      await this.db!.runAsync('DELETE FROM active_timers');
      for (const b of data.babies) await this.addBaby(b);
      for (const e of data.events) await this.addEvent(e);
      for (const t of data.activeTimers) await this.addTimer(t);
    });
  }

  async close(): Promise<void> {
    await this.db?.closeAsync();
    this.db = null;
  }
}
