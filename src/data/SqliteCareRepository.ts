import * as SQLite from 'expo-sqlite';
import type {
  ActiveTimer, AppData, Baby, CareEvent, GrowthRecord, MedicationAdministration,
  MedicationRecord, MilestoneRecord, RoutineTemplate, VaccinationRecord,
} from '../models/types';
import type { CareRepository } from './CareRepository';
import { missingColumns, type ColumnDef } from '../models/columns';

const SCHEMA_VERSION = 3;

const ACTIVE_TIMER_V2_COLUMNS: ColumnDef[] = [
  { name: 'segments', ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: 'lastSide', ddl: 'TEXT' },
];

// Statement runner shared by the database handle and open transactions so the
// same insert helpers serve both single writes and transactional bulk writes.
type Runner = Pick<SQLite.SQLiteDatabase, 'runAsync'>;

export class SqliteCareRepository implements CareRepository {
  private db: SQLite.SQLiteDatabase | null = null;
  private demoMode = false;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync('ninninest.db');
    await this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    const db = this.db!;
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS babies (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        birthDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        photoUri TEXT,
        preferredUnits TEXT,
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
        segments TEXT NOT NULL DEFAULT '[]',
        lastSide TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
    `);
    await this.ensurePhaseCTables();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      ['schema_version']
    );
    if (!row) {
      await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', [
        'schema_version',
        String(SCHEMA_VERSION),
      ]);
    } else {
      const from = Number(row.value);
      if (from < 2) await this.migrateV1toV2();
      if (from < 3) await this.migrateV2toV3();
    }
    if (Number(row?.value ?? SCHEMA_VERSION) < SCHEMA_VERSION) {
      await db.runAsync('UPDATE meta SET value = ? WHERE key = ?', [
        String(SCHEMA_VERSION),
        'schema_version',
      ]);
    }
    // Fresh-install repair, run UNCONDITIONALLY and idempotently: the v2
    // columns used to be added only by the v1→v2 migration, so databases
    // created directly at v3 were missing `segments`/`lastSide` and every
    // timer start failed (found on real device, 0.9.1). The helper is
    // PRAGMA-guarded, so this is a no-op on correct schemas.
    await this.migrateV1toV2();
  }

  private async ensurePhaseCTables(): Promise<void> {
    // CREATE TABLE IF NOT EXISTS makes this idempotent for fresh installs and migrations.
    await this.db!.execAsync(`
      CREATE TABLE IF NOT EXISTS growth_records (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        date TEXT NOT NULL,
        weightGrams REAL,
        heightCm REAL,
        headCircumferenceCm REAL,
        note TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_growth_baby_date ON growth_records (babyId, date);
      CREATE TABLE IF NOT EXISTS milestones (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        photoUri TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_milestones_baby_date ON milestones (babyId, date);
      CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        name TEXT NOT NULL,
        instructions TEXT,
        doseAmount REAL,
        doseUnit TEXT,
        notes TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS medication_administrations (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        medicationId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        doseAmount REAL,
        doseUnit TEXT,
        note TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_admin_baby_ts ON medication_administrations (babyId, timestamp);
      CREATE TABLE IF NOT EXISTS vaccinations (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        name TEXT NOT NULL,
        dateGiven TEXT NOT NULL,
        nextAppointment TEXT,
        provider TEXT,
        notes TEXT,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_vax_baby_date ON vaccinations (babyId, dateGiven);
      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY NOT NULL,
        babyId TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        timeOfDay TEXT NOT NULL,
        days TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        isDemo INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  private async migrateV1toV2(): Promise<void> {
    // Column checks make this retry-safe: a migration interrupted after the
    // first ALTER is completed correctly by a second pass, never throwing.
    const timerCols = await this.db!.getAllAsync<{ name: string }>(
      'PRAGMA table_info(active_timers)'
    );
    const toAdd = missingColumns(timerCols.map((c) => c.name), ACTIVE_TIMER_V2_COLUMNS);
    for (const def of toAdd) {
      await this.db!.execAsync(`ALTER TABLE active_timers ADD COLUMN ${def.name} ${def.ddl};`);
    }
    const legacy = await this.db!.getAllAsync<{ id: string; startedAt: string; segments: string | null }>(
      'SELECT id, startedAt, segments FROM active_timers'
    );
    for (const t of legacy) {
      if (t.segments && t.segments !== '[]') continue; // already upgraded
      await this.db!.runAsync('UPDATE active_timers SET segments = ? WHERE id = ?', [
        JSON.stringify([{ start: t.startedAt, end: null }]),
        t.id,
      ]);
    }
  }

  private async migrateV2toV3(): Promise<void> {
    // v3 widens babies (photoUri, preferredUnits) and adds the Phase C tables.
    const babyCols = await this.db!.getAllAsync<{ name: string }>(
      "PRAGMA table_info(babies)"
    );
    const names = new Set(babyCols.map((c) => c.name));
    if (!names.has('photoUri')) {
      await this.db!.execAsync('ALTER TABLE babies ADD COLUMN photoUri TEXT;');
    }
    if (!names.has('preferredUnits')) {
      await this.db!.execAsync('ALTER TABLE babies ADD COLUMN preferredUnits TEXT;');
    }
    await this.ensurePhaseCTables();
  }

  async loadAll(): Promise<AppData> {
    if (!this.db) throw new Error('repository not initialised');
    const babies: Baby[] = [];
    const babyRows = await this.db.getAllAsync<{
      id: string; name: string; birthDate: string; createdAt: string;
      photoUri: string | null; preferredUnits: string | null; isDemo: number;
    }>('SELECT * FROM babies');
    for (const r of babyRows) {
      babies.push({
        id: r.id, name: r.name, birthDate: r.birthDate, createdAt: r.createdAt,
        photoUri: r.photoUri ?? undefined,
        preferredUnits: (r.preferredUnits as Baby['preferredUnits'] | null) ?? undefined,
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
      id: string; babyId: string; kind: string; startedAt: string; side: string | null;
      segments: string | null; lastSide: string | null; isDemo: number;
    }>('SELECT * FROM active_timers');
    for (const r of timerRows) {
      let segments: ActiveTimer['segments'] = [];
      try {
        const parsed = r.segments ? (JSON.parse(r.segments) as ActiveTimer['segments']) : [];
        if (Array.isArray(parsed) && parsed.length > 0) segments = parsed;
      } catch {
        // fall through to legacy reconstruction
      }
      if (segments.length === 0) segments = [{ start: r.startedAt, end: null }];
      activeTimers.push({
        id: r.id, babyId: r.babyId, kind: r.kind as ActiveTimer['kind'],
        startedAt: r.startedAt, side: (r.side ?? undefined) as ActiveTimer['side'],
        segments,
        lastSide: (r.lastSide ?? undefined) as ActiveTimer['lastSide'],
        isDemo: r.isDemo === 1,
      });
    }
    const growthRecords = await this.loadGrowth();
    const milestones = await this.loadMilestones();
    const medications = await this.loadMedications();
    const medicationAdministrations = await this.loadAdministrations();
    const vaccinations = await this.loadVaccinations();
    const routines = await this.loadRoutines();
    return {
      babies, events, activeTimers, growthRecords, milestones, medications,
      medicationAdministrations, vaccinations, routines, schemaVersion: 3 as const,
    };
  }

  private async loadGrowth(): Promise<GrowthRecord[]> {
    const rows = await this.db!.getAllAsync<{
      id: string; babyId: string; date: string; weightGrams: number | null;
      heightCm: number | null; headCircumferenceCm: number | null;
      note: string | null; isDemo: number;
    }>('SELECT * FROM growth_records ORDER BY date');
    return rows.map((r) => ({
      id: r.id, babyId: r.babyId, date: r.date,
      weightGrams: r.weightGrams ?? undefined,
      heightCm: r.heightCm ?? undefined,
      headCircumferenceCm: r.headCircumferenceCm ?? undefined,
      note: r.note ?? undefined, isDemo: r.isDemo === 1,
    }));
  }

  private async loadMilestones(): Promise<MilestoneRecord[]> {
    const rows = await this.db!.getAllAsync<{
      id: string; babyId: string; category: string; title: string; date: string;
      note: string | null; photoUri: string | null; isDemo: number;
    }>('SELECT * FROM milestones ORDER BY date');
    return rows.map((r) => ({
      id: r.id, babyId: r.babyId, category: r.category as MilestoneRecord['category'],
      title: r.title, date: r.date, note: r.note ?? undefined,
      photoUri: r.photoUri ?? undefined, isDemo: r.isDemo === 1,
    }));
  }

  private async loadMedications(): Promise<MedicationRecord[]> {
    const rows = await this.db!.getAllAsync<{
      id: string; babyId: string; name: string; instructions: string | null;
      doseAmount: number | null; doseUnit: string | null; notes: string | null; isDemo: number;
    }>('SELECT * FROM medications');
    return rows.map((r) => ({
      id: r.id, babyId: r.babyId, name: r.name, instructions: r.instructions ?? undefined,
      doseAmount: r.doseAmount ?? undefined,
      doseUnit: (r.doseUnit as MedicationRecord['doseUnit'] | null) ?? undefined,
      notes: r.notes ?? undefined, isDemo: r.isDemo === 1,
    }));
  }

  private async loadAdministrations(): Promise<MedicationAdministration[]> {
    const rows = await this.db!.getAllAsync<{
      id: string; babyId: string; medicationId: string; timestamp: string;
      doseAmount: number | null; doseUnit: string | null; note: string | null; isDemo: number;
    }>('SELECT * FROM medication_administrations ORDER BY timestamp');
    return rows.map((r) => ({
      id: r.id, babyId: r.babyId, medicationId: r.medicationId, timestamp: r.timestamp,
      doseAmount: r.doseAmount ?? undefined,
      doseUnit: (r.doseUnit as MedicationAdministration['doseUnit'] | null) ?? undefined,
      note: r.note ?? undefined, isDemo: r.isDemo === 1,
    }));
  }

  private async loadVaccinations(): Promise<VaccinationRecord[]> {
    const rows = await this.db!.getAllAsync<{
      id: string; babyId: string; name: string; dateGiven: string;
      nextAppointment: string | null; provider: string | null;
      notes: string | null; isDemo: number;
    }>('SELECT * FROM vaccinations ORDER BY dateGiven');
    return rows.map((r) => ({
      id: r.id, babyId: r.babyId, name: r.name, dateGiven: r.dateGiven,
      nextAppointment: r.nextAppointment ?? undefined, provider: r.provider ?? undefined,
      notes: r.notes ?? undefined, isDemo: r.isDemo === 1,
    }));
  }

  private async loadRoutines(): Promise<RoutineTemplate[]> {
    const rows = await this.db!.getAllAsync<{
      id: string; babyId: string; title: string; kind: string; timeOfDay: string;
      days: string; active: number; isDemo: number;
    }>('SELECT * FROM routines');
    return rows.map((r) => {
      let days: number[] = [];
      try {
        const parsed = JSON.parse(r.days) as number[];
        if (Array.isArray(parsed)) days = parsed;
      } catch {
        // leave empty; routine then never fires rather than crashing
      }
      return {
        id: r.id, babyId: r.babyId, title: r.title,
        kind: r.kind as RoutineTemplate['kind'], timeOfDay: r.timeOfDay, days,
        active: r.active === 1, isDemo: r.isDemo === 1,
      };
    });
  }

  async addBaby(baby: Baby): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addBabyOn(this.db, baby);
  }

  private async addBabyOn(run: Runner, baby: Baby): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO babies (id, name, birthDate, createdAt, photoUri, preferredUnits, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        baby.id, baby.name, baby.birthDate, baby.createdAt,
        baby.photoUri ?? null, baby.preferredUnits ?? null, baby.isDemo ? 1 : 0,
      ]
    );
  }

  async updateBaby(baby: Baby): Promise<void> {
    return this.addBaby(baby);
  }

  async deleteBaby(babyId: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.withTransactionAsync(async () => {
      const tables = [
        'babies', 'events', 'active_timers', 'growth_records', 'milestones',
        'medications', 'medication_administrations', 'vaccinations', 'routines',
      ];
      for (const table of tables) {
        if (table === 'babies') {
          await this.db!.runAsync('DELETE FROM babies WHERE id = ?', [babyId]);
        } else {
          await this.db!.runAsync(`DELETE FROM ${table} WHERE babyId = ?`, [babyId]);
        }
      }
    });
  }

  async addEvent(event: CareEvent): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addEventOn(this.db, event);
  }

  private async addEventOn(run: Runner, event: CareEvent): Promise<void> {
    await run.runAsync(
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
    return this.addTimerOn(this.db, timer);
  }

  private async addTimerOn(run: Runner, timer: ActiveTimer): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO active_timers (id, babyId, kind, startedAt, side, segments, lastSide, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        timer.id, timer.babyId, timer.kind, timer.startedAt, timer.side ?? null,
        JSON.stringify(timer.segments), timer.lastSide ?? null, timer.isDemo ? 1 : 0,
      ]
    );
  }

  async deleteTimer(timerId: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM active_timers WHERE id = ?', [timerId]);
  }

  async addGrowthRecord(record: GrowthRecord): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addGrowthRecordOn(this.db, record);
  }

  private async addGrowthRecordOn(run: Runner, record: GrowthRecord): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO growth_records (id, babyId, date, weightGrams, heightCm, headCircumferenceCm, note, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.babyId, record.date, record.weightGrams ?? null,
        record.heightCm ?? null, record.headCircumferenceCm ?? null,
        record.note ?? null, record.isDemo ? 1 : 0,
      ]
    );
  }

  async deleteGrowthRecord(id: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM growth_records WHERE id = ?', [id]);
  }

  async addMilestone(record: MilestoneRecord): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addMilestoneOn(this.db, record);
  }

  private async addMilestoneOn(run: Runner, record: MilestoneRecord): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO milestones (id, babyId, category, title, date, note, photoUri, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.babyId, record.category, record.title, record.date,
        record.note ?? null, record.photoUri ?? null, record.isDemo ? 1 : 0,
      ]
    );
  }

  async deleteMilestone(id: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM milestones WHERE id = ?', [id]);
  }

  async addMedication(record: MedicationRecord): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addMedicationOn(this.db, record);
  }

  private async addMedicationOn(run: Runner, record: MedicationRecord): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO medications (id, babyId, name, instructions, doseAmount, doseUnit, notes, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.babyId, record.name, record.instructions ?? null,
        record.doseAmount ?? null, record.doseUnit ?? null, record.notes ?? null,
        record.isDemo ? 1 : 0,
      ]
    );
  }

  async deleteMedication(id: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.withTransactionAsync(async () => {
      await this.db!.runAsync('DELETE FROM medications WHERE id = ?', [id]);
      await this.db!.runAsync('DELETE FROM medication_administrations WHERE medicationId = ?', [id]);
    });
  }

  async addMedicationAdministration(record: MedicationAdministration): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addMedicationAdministrationOn(this.db, record);
  }

  private async addMedicationAdministrationOn(run: Runner, record: MedicationAdministration): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO medication_administrations (id, babyId, medicationId, timestamp, doseAmount, doseUnit, note, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.babyId, record.medicationId, record.timestamp,
        record.doseAmount ?? null, record.doseUnit ?? null, record.note ?? null,
        record.isDemo ? 1 : 0,
      ]
    );
  }

  async deleteMedicationAdministration(id: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM medication_administrations WHERE id = ?', [id]);
  }

  async addVaccination(record: VaccinationRecord): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addVaccinationOn(this.db, record);
  }

  private async addVaccinationOn(run: Runner, record: VaccinationRecord): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO vaccinations (id, babyId, name, dateGiven, nextAppointment, provider, notes, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.babyId, record.name, record.dateGiven,
        record.nextAppointment ?? null, record.provider ?? null, record.notes ?? null,
        record.isDemo ? 1 : 0,
      ]
    );
  }

  async deleteVaccination(id: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM vaccinations WHERE id = ?', [id]);
  }

  async addRoutine(record: RoutineTemplate): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    return this.addRoutineOn(this.db, record);
  }

  private async addRoutineOn(run: Runner, record: RoutineTemplate): Promise<void> {
    await run.runAsync(
      'INSERT OR REPLACE INTO routines (id, babyId, title, kind, timeOfDay, days, active, isDemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id, record.babyId, record.title, record.kind, record.timeOfDay,
        JSON.stringify(record.days), record.active ? 1 : 0, record.isDemo ? 1 : 0,
      ]
    );
  }

  async deleteRoutine(id: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.runAsync('DELETE FROM routines WHERE id = ?', [id]);
  }

  async replaceAll(data: AppData): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    // EXCLUSIVE (not the default DEFERRED): a backup import is the one moment
    // a bulk rewrite meets potentially concurrent single-row writes (a timer
    // finishing, a quick log). With DEFERRED those writes could JOIN the open
    // transaction and silently vanish if it rolled back; EXCLUSIVE keeps them
    // queued until the import has committed (or rolled back) as a unit.
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      for (const table of [
        'babies', 'events', 'active_timers', 'growth_records', 'milestones',
        'medications', 'medication_administrations', 'vaccinations', 'routines',
      ]) {
        await txn.runAsync(`DELETE FROM ${table}`);
      }
      for (const b of data.babies) await this.addBabyOn(txn, b);
      for (const e of data.events) await this.addEventOn(txn, e);
      for (const t of data.activeTimers) await this.addTimerOn(txn, t);
      for (const g of data.growthRecords) await this.addGrowthRecordOn(txn, g);
      for (const m of data.milestones) await this.addMilestoneOn(txn, m);
      for (const m of data.medications) await this.addMedicationOn(txn, m);
      for (const a of data.medicationAdministrations) await this.addMedicationAdministrationOn(txn, a);
      for (const v of data.vaccinations) await this.addVaccinationOn(txn, v);
      for (const r of data.routines) await this.addRoutineOn(txn, r);
    });
  }

  /**
   * Timer completion in ONE exclusive transaction: the journal event and the
   * timer removal commit together or not at all. This closes the kill-between-
   * writes window (duplicate event on retry) and the double-tap window that
   * the compensating fallback could only narrow.
   */
  async completeTimerAtomic(event: CareEvent, timerId: string): Promise<void> {
    if (!this.db) throw new Error('repository not initialised');
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await this.addEventOn(txn, event);
      await txn.runAsync('DELETE FROM active_timers WHERE id = ?', [timerId]);
    });
  }

  async close(): Promise<void> {
    await this.db?.closeAsync();
    this.db = null;
  }

  async setDemoMode(on: boolean): Promise<void> {
    if (this.demoMode === on) return;
    this.demoMode = on;
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    // Separate database file per realm: personal rows in ninninest.db are
    // physically unreachable while demo mode is active (ninninest-demo.db).
    this.db = await SQLite.openDatabaseAsync(on ? 'ninninest-demo.db' : 'ninninest.db');
    await this.ensureSchema();
  }
}
