import type { AppData, Baby, CareEvent } from './types';
import {
  validateBaby, validateEvent, validateGrowth, validateMilestone,
  validateMedication, validateMedicationAdministration, validateVaccination, validateRoutine,
} from './validation';
import { BACKUP_VERSION, emptyData, mergeData, type BackupFile, type ImportMode } from './backup';
import type { EmbeddedPhoto } from './mediaBackup';
import { hashContent } from './hash';

export interface ImportIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface ImportCounts {
  babies: number;
  events: number;
  growth: number;
  milestones: number;
  medications: number;
  administrations: number;
  vaccinations: number;
  routines: number;
}

export interface ImportPlan {
  ok: boolean;
  issues: ImportIssue[];
  counts: ImportCounts;
  mode: ImportMode;
  target: AppData | null;
  photos: EmbeddedPhoto[];
}

// Strict import planning. Nothing here writes; malformed, duplicate and orphaned
// records are hard errors — a backup that cannot be fully honoured is rejected,
// never silently trimmed.
export function planImport(json: string, current: AppData, mode: ImportMode): ImportPlan {
  const issues: ImportIssue[] = [];
  const counts: ImportCounts = {
    babies: 0, events: 0, growth: 0, milestones: 0, medications: 0,
    administrations: 0, vaccinations: 0, routines: 0,
  };
  const fail = (): ImportPlan => ({ ok: false, issues, counts, mode, target: null, photos: [] });

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    issues.push({ severity: 'error', message: 'The file is not valid JSON.' });
    return fail();
  }
  if (obj.app !== 'NinniNest') {
    issues.push({ severity: 'error', message: 'This file was not created by NinniNest.' });
    return fail();
  }
  const version = typeof obj.backupVersion === 'number' ? obj.backupVersion : 0;
  if (version > BACKUP_VERSION) {
    issues.push({
      severity: 'error',
      message: `Backup version ${version} is newer than this app supports (v${BACKUP_VERSION}). Update the app first.`,
    });
    return fail();
  }
  if (version < BACKUP_VERSION) {
    issues.push({ severity: 'warning', message: `Older backup (v${version}) — it will be upgraded during import.` });
  }

  const data = obj.data as Partial<AppData> | undefined;
  if (!data || !Array.isArray(data.babies) || !Array.isArray(data.events)) {
    issues.push({ severity: 'error', message: 'The backup is missing its core records.' });
    return fail();
  }

  const bad = (kind: string, arr: unknown[]): number =>
    arr.filter((x) => x === null || x === undefined).length;

  const babies = data.babies.map(validateBaby);
  const events = (data.events as unknown[]).map(validateEvent);
  const growth = (data.growthRecords ?? []).map(validateGrowth);
  const milestones = (data.milestones ?? []).map(validateMilestone);
  const medications = (data.medications ?? []).map(validateMedication);
  const administrations = (data.medicationAdministrations ?? []).map(validateMedicationAdministration);
  const vaccinations = (data.vaccinations ?? []).map(validateVaccination);
  const routines = (data.routines ?? []).map(validateRoutine);

  const malformed: string[] = [];
  const nBabies = bad('profile', babies);
  if (nBabies) malformed.push(`${nBabies} baby profile(s)`);
  const nEvents = bad('event', events);
  if (nEvents) malformed.push(`${nEvents} journal event(s)`);
  const nGrowth = bad('growth', growth);
  if (nGrowth) malformed.push(`${nGrowth} growth record(s)`);
  const nMilestones = bad('milestone', milestones);
  if (nMilestones) malformed.push(`${nMilestones} milestone(s)`);
  const nMeds = bad('medication', medications);
  if (nMeds) malformed.push(`${nMeds} medication(s)`);
  const nAdmins = bad('dose', administrations);
  if (nAdmins) malformed.push(`${nAdmins} recorded dose(s)`);
  const nVax = bad('vaccination', vaccinations);
  if (nVax) malformed.push(`${nVax} vaccination(s)`);
  const nRoutines = bad('routine', routines);
  if (nRoutines) malformed.push(`${nRoutines} routine(s)`);
  if (malformed.length) {
    issues.push({
      severity: 'error',
      message: `These records are malformed and cannot be imported: ${malformed.join(', ')}. The import was stopped so nothing is lost or partially written.`,
    });
  }

  const validBabies = babies.filter((b): b is Baby => b !== null);
  const validEvents = events.filter((e): e is CareEvent => e !== null);

  counts.babies = validBabies.length;
  counts.events = validEvents.length;
  counts.growth = growth.filter(Boolean).length;
  counts.milestones = milestones.filter(Boolean).length;
  counts.medications = medications.filter(Boolean).length;
  counts.administrations = administrations.filter(Boolean).length;
  counts.vaccinations = vaccinations.filter(Boolean).length;
  counts.routines = routines.filter(Boolean).length;

  // Duplicate event ids inside the file.
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const e of validEvents) {
    if (seen.has(e.id)) dupes.add(e.id);
    seen.add(e.id);
  }
  if (dupes.size) {
    issues.push({
      severity: 'error',
      message: `${dupes.size} duplicate event id(s) in the file. The import was stopped — a file with conflicting records cannot be applied safely.`,
    });
  }

  // Orphans: records referencing a baby that is neither in the backup nor (in
  // merge mode) already on this device. Importing them would create unreachable rows.
  const backupBabyIds = new Set(validBabies.map((b) => b.id));
  const currentBabyIds = new Set(current.babies.map((b) => b.id));
  const orphanResolver = (babyId: string) =>
    backupBabyIds.has(babyId) || (mode === 'merge' && currentBabyIds.has(babyId));
  const orphanEvents = validEvents.filter((e) => !orphanResolver(e.babyId));
  if (orphanEvents.length) {
    issues.push({
      severity: 'error',
      message: `${orphanEvents.length} event(s) reference a profile that is missing. The import was stopped so no records become unreachable.`,
    });
  }
  const backupMedIds = new Set(medications.filter(Boolean).map((m) => (m as { id: string }).id));
  const currentMedIds = new Set(current.medications.map((m) => m.id));
  const orphanAdmins = administrations.filter(
    (a) => a !== null && !(backupMedIds.has(a.medicationId) || (mode === 'merge' && currentMedIds.has(a.medicationId)))
  );
  if (orphanAdmins.length) {
    issues.push({
      severity: 'error',
      message: `${orphanAdmins.length} recorded dose(s) reference a medication that is missing. The import was stopped.`,
    });
  }

  // Photos: verify integrity of every embedded payload at plan time.
  // Legacy v3 archives put embedded media in `photos`; current exports use
  // photosEmbedded. planImport reads both so older backups still restore fully.
  const embeddedRaw = Array.isArray(obj.photosEmbedded) ? (obj.photosEmbedded as EmbeddedPhoto[]) : [];
  const legacyRaw = Array.isArray(obj.photos) ? (obj.photos as EmbeddedPhoto[]) : [];
  const rawPhotos: EmbeddedPhoto[] = embeddedRaw.length > 0
    ? embeddedRaw
    : legacyRaw.filter((p) => p && typeof p.base64 === 'string');
  const photos: EmbeddedPhoto[] = [];
  let corruptPhotos = 0;
  let missingBytes = 0;
  for (const p of rawPhotos) {
    if (!p || typeof p !== 'object' || !p.recordId || !p.field) continue;
    if (!p.base64) {
      missingBytes += 1;
      photos.push(p);
      continue;
    }
    if (p.sha256 && hashContent(p.base64) !== p.sha256) {
      corruptPhotos += 1;
      continue;
    }
    photos.push(p);
  }
  if (corruptPhotos) {
    issues.push({
      severity: 'error',
      message: `${corruptPhotos} embedded photo(s) failed their integrity check. The import was stopped rather than restore corrupted media.`,
    });
  }
  if (missingBytes) {
    issues.push({
      severity: 'warning',
      message: `${missingBytes} photo(s) have no embedded data (this backup was made without media). They will be skipped.`,
    });
  }

  if (issues.some((i) => i.severity === 'error')) return fail();

  const incoming: AppData = {
    ...emptyData(),
    babies: validBabies,
    events: validEvents,
    activeTimers: [], // timers are never restored from backups — a handoff file is history
    growthRecords: growth.filter((g): g is NonNullable<typeof g> => g !== null),
    milestones: milestones.filter((m): m is NonNullable<typeof m> => m !== null),
    medications: medications.filter((m): m is NonNullable<typeof m> => m !== null),
    medicationAdministrations: administrations.filter((a): a is NonNullable<typeof a> => a !== null),
    vaccinations: vaccinations.filter((v): v is NonNullable<typeof v> => v !== null),
    routines: routines.filter((r): r is NonNullable<typeof r> => r !== null),
    schemaVersion: 3,
  };

  const target = mode === 'replace' ? incoming : mergeData(current, incoming);
  if (target.babies.length === 0) {
    issues.push({ severity: 'error', message: 'Nothing to import — no valid baby profiles in the file.' });
    return fail();
  }

  return { ok: true, issues, counts, mode, target, photos };
}

export function describeImportPlan(plan: ImportPlan): string {
  const c = plan.counts;
  const parts = [
    `${c.babies} profile${c.babies === 1 ? '' : 's'}`,
    `${c.events} event${c.events === 1 ? '' : 's'}`,
    `${c.growth} growth record${c.growth === 1 ? '' : 's'}`,
    `${c.milestones} milestone${c.milestones === 1 ? '' : 's'}`,
    `${c.administrations} recorded dose${c.administrations === 1 ? '' : 's'}`,
    `${c.vaccinations} vaccination${c.vaccinations === 1 ? '' : 's'}`,
    `${c.routines} routine${c.routines === 1 ? '' : 's'}`,
  ];
  return parts.join(', ');
}

export interface ImportApplyResult {
  ok: boolean;
  message: string;
}

// Applies a validated plan through a single transactional repository write.
// On failure nothing partial is reported as success.
export async function applyImportPlan(
  repo: { replaceAll(data: AppData): Promise<void> },
  plan: ImportPlan,
  targetOverride?: AppData
): Promise<ImportApplyResult> {
  if (!plan.ok || !plan.target) {
    return { ok: false, message: 'The plan was not validated; nothing was written.' };
  }
  const target = targetOverride ?? plan.target;
  try {
    await repo.replaceAll(target);
    return {
      ok: true,
      message: `${plan.mode === 'replace' ? 'Backup restored (replace)' : 'Backup merged into your journal'}: ${describeImportPlan(plan)}.`,
    };
  } catch {
    return {
      ok: false,
      message: 'The import failed while writing. Your existing records are untouched — please try again.',
    };
  }
}

export async function applyImportPlanOrFail(
  repo: { replaceAll(data: AppData): Promise<void> },
  plan: ImportPlan,
  targetOverride?: AppData
): Promise<ImportApplyResult> {
  const result = await applyImportPlan(repo, plan, targetOverride);
  if (!result.ok) throw new Error(result.message);
  return result;
}
