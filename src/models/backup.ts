import type { AppData, Baby, CareEvent } from './types';
import {
  validateBaby, validateEvent, validateTimer, validateGrowth, validateMilestone,
  validateMedication, validateMedicationAdministration, validateVaccination, validateRoutine,
} from './validation';

export const BACKUP_VERSION = 4;

export interface PhotoManifestEntry {
  recordId: string;
  field: 'babyPhoto' | 'milestonePhoto';
  fileName: string;
}

export interface EmbeddedPhotoData {
  recordId: string;
  field: 'babyPhoto' | 'milestonePhoto';
  fileName: string;
  base64?: string;
  sha256?: string;
}

export interface BackupFile {
  app: 'NinniNest';
  backupVersion: number;
  exportedAt: string;
  data: AppData;
  photos: EmbeddedPhotoData[]; // manifest; base64 bytes present when media-inclusive
  settings?: { themeMode?: string };
}

export interface DryRunIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface DryRunResult {
  ok: boolean;
  issues: DryRunIssue[];
  counts: {
    babies: number;
    events: number;
    timers: number;
    growth: number;
    milestones: number;
    medications: number;
    administrations: number;
    vaccinations: number;
    routines: number;
  };
  duplicateEventIds: string[];
}

export interface ParsedBackup {
  backup: BackupFile;
  dryRun: DryRunResult;
}

export type ImportMode = 'replace' | 'merge';

function emptyCounts() {
  return {
    babies: 0, events: 0, timers: 0, growth: 0, milestones: 0,
    medications: 0, administrations: 0, vaccinations: 0, routines: 0,
  };
}

// Full structural validation without touching stored data. A backup whose
// records are malformed is reported, not silently trimmed.
export function dryRunParse(json: string): ParsedBackup {
  const issues: DryRunIssue[] = [];
  const counts = emptyCounts();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      backup: { app: 'NinniNest', backupVersion: 0, exportedAt: '', data: emptyData(), photos: [] },
      dryRun: { ok: false, issues: [{ severity: 'error', message: 'The file is not valid JSON.' }], counts, duplicateEventIds: [] },
    };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.app !== 'NinniNest') {
    issues.push({ severity: 'error', message: 'This file was not created by NinniNest.' });
  }
  const version = typeof obj.backupVersion === 'number' ? obj.backupVersion : 0;
  if (version > BACKUP_VERSION) {
    issues.push({ severity: 'error', message: `This backup uses version ${version}, newer than this app supports (v${BACKUP_VERSION}). Update the app first.` });
  } else if (version < BACKUP_VERSION) {
    issues.push({ severity: 'warning', message: `Older backup (v${version}) — it will be upgraded during import.` });
  }

  const data = obj.data as Partial<AppData> | undefined;
  if (!data || !Array.isArray(data.babies) || !Array.isArray(data.events)) {
    issues.push({ severity: 'error', message: 'The backup is missing its core records.' });
    return {
      backup: { app: 'NinniNest', backupVersion: version, exportedAt: String(obj.exportedAt ?? ''), data: emptyData(), photos: [] },
      dryRun: { ok: false, issues, counts, duplicateEventIds: [] },
    };
  }

  const babies = data.babies.map(validateBaby);
  const events = data.events.map(validateEvent);
  const timers = (data.activeTimers ?? []).map(validateTimer);
  const growth = (data.growthRecords ?? []).map(validateGrowth);
  const milestones = (data.milestones ?? []).map(validateMilestone);
  const medications = (data.medications ?? []).map(validateMedication);
  const administrations = (data.medicationAdministrations ?? []).map(validateMedicationAdministration);
  const vaccinations = (data.vaccinations ?? []).map(validateVaccination);
  const routines = (data.routines ?? []).map(validateRoutine);

  const invalid = (arr: unknown[]) => arr.filter((x) => x === null).length;
  if (invalid(babies)) issues.push({ severity: 'warning', message: `${invalid(babies)} baby profile(s) could not be read and will be skipped.` });
  if (invalid(events)) issues.push({ severity: 'warning', message: `${invalid(events)} journal event(s) could not be read and will be skipped.` });

  counts.babies = babies.filter(Boolean).length;
  counts.events = events.filter(Boolean).length;
  counts.timers = timers.filter(Boolean).length;
  counts.growth = growth.filter(Boolean).length;
  counts.milestones = milestones.filter(Boolean).length;
  counts.medications = medications.filter(Boolean).length;
  counts.administrations = administrations.filter(Boolean).length;
  counts.vaccinations = vaccinations.filter(Boolean).length;
  counts.routines = routines.filter(Boolean).length;

  // Duplicate detection within the file itself.
  const seen = new Set<string>();
  const duplicateEventIds: string[] = [];
  for (const e of events) {
    if (e && seen.has(e.id)) duplicateEventIds.push(e.id);
    if (e) seen.add(e.id);
  }
  if (duplicateEventIds.length) {
    issues.push({ severity: 'warning', message: `${duplicateEventIds.length} duplicate event id(s) in the file — duplicates are ignored.` });
  }

  // Orphan checks: children referencing missing babies.
  const babyIds = new Set(babies.filter(Boolean).map((b) => (b as Baby).id));
  const orphanEvents = events.filter((e) => e && !babyIds.has(e.babyId)).length;
  if (orphanEvents) {
    issues.push({ severity: 'warning', message: `${orphanEvents} event(s) reference profiles not in the backup; they will be imported under their recorded profile id.` });
  }

  const hardErrors = issues.filter((i) => i.severity === 'error').length;
  return {
    backup: {
      app: 'NinniNest',
      backupVersion: version,
      exportedAt: String(obj.exportedAt ?? ''),
      data: {
        babies: babies.filter((b): b is Baby => b !== null),
        events: events.filter((e): e is CareEvent => e !== null),
        activeTimers: timers.filter((t): t is NonNullable<ReturnType<typeof validateTimer>> => t !== null),
        growthRecords: growth.filter((g): g is NonNullable<ReturnType<typeof validateGrowth>> => g !== null),
        milestones: milestones.filter((m): m is NonNullable<ReturnType<typeof validateMilestone>> => m !== null),
        medications: medications.filter((m): m is NonNullable<ReturnType<typeof validateMedication>> => m !== null),
        medicationAdministrations: administrations.filter((a): a is NonNullable<ReturnType<typeof validateMedicationAdministration>> => a !== null),
        vaccinations: vaccinations.filter((v): v is NonNullable<ReturnType<typeof validateVaccination>> => v !== null),
        routines: routines.filter((r): r is NonNullable<ReturnType<typeof validateRoutine>> => r !== null),
        schemaVersion: 3,
      },
      photos: Array.isArray(obj.photos) ? (obj.photos as BackupFile['photos']) : [],
      settings: (obj.settings as BackupFile['settings']) ?? undefined,
    },
    dryRun: { ok: hardErrors === 0, issues, counts, duplicateEventIds },
  };
}

export function emptyData(): AppData {
  return {
    babies: [], events: [], activeTimers: [], growthRecords: [], milestones: [],
    medications: [], medicationAdministrations: [], vaccinations: [], routines: [],
    schemaVersion: 3,
  };
}

// Merge keeps existing records and adds only records whose ids are new.
export function mergeData(current: AppData, incoming: AppData): AppData {
  const merged: AppData = { ...current, schemaVersion: 3 };
  const mergeBy = <T extends { id: string }>(list: T[], add: T[]): T[] => {
    const ids = new Set(list.map((x) => x.id));
    return [...list, ...add.filter((x) => !ids.has(x.id))];
  };
  merged.babies = mergeBy(current.babies, incoming.babies);
  merged.events = mergeBy(current.events, incoming.events);
  merged.activeTimers = mergeBy(current.activeTimers, incoming.activeTimers);
  merged.growthRecords = mergeBy(current.growthRecords, incoming.growthRecords);
  merged.milestones = mergeBy(current.milestones, incoming.milestones);
  merged.medications = mergeBy(current.medications, incoming.medications);
  merged.medicationAdministrations = mergeBy(current.medicationAdministrations, incoming.medicationAdministrations);
  merged.vaccinations = mergeBy(current.vaccinations, incoming.vaccinations);
  merged.routines = mergeBy(current.routines, incoming.routines);
  return merged;
}

export function buildBackup(data: AppData, settings?: { themeMode?: string }): BackupFile {
  return {
    app: 'NinniNest',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    photos: [],
    settings,
  };
}
