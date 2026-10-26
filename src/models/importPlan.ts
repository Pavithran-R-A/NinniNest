import type { AppData, Baby, CareEvent } from './types';
import {
  validateBaby, validateEvent, validateGrowth, validateMilestone,
  validateMedication, validateMedicationAdministration, validateVaccination, validateRoutine,
} from './validation';
import { BACKUP_VERSION, emptyData, mergeData, type BackupFile, type ImportMode } from './backup';
import type { EmbeddedPhoto } from './mediaBackup';
import { decodeBase64Strict, hashContent, sha256Hex } from './hash';

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

/**
 * Hard import bounds. A backup is untrusted input: these caps sit BEFORE
 * JSON.parse and record validation so an adversarial or accidentally huge
 * file cannot exhaust memory (the installed zod 4.6.7 is the newest 4.x and
 * carries a known oversized-collection advisory — bounding the input is the
 * mitigation, not a zod upgrade).
 *
 * Envelope evidence: a 100-photo backup measures ≈25 MB (tests/backupSize).
 * The 64 MB cap ≈ 250 photos and ≈2.5× headroom over any plausible journal;
 * JSON.parse of a 64 MB string peaks at several times its size in RAM, which
 * stays within mid-range Android heap budgets. 300 MB was rejected: parse +
 * validation + base64 decode could demand >1 GB transient memory.
 */
export const IMPORT_LIMITS = {
  /** Maximum JSON text length accepted for parsing (chars ≈ bytes for backup payloads). */
  maxJsonChars: 64 * 1024 * 1024,
  /** Maximum records per collection in one backup file. */
  maxPerCollection: {
    babies: 100,
    events: 200_000,
    activeTimers: 100,
    growthRecords: 10_000,
    milestones: 10_000,
    medications: 2_000,
    medicationAdministrations: 100_000,
    vaccinations: 1_000,
    routines: 1_000,
  } as const,
  /** Maximum embedded photo entries (bytes-bearing or not). */
  maxEmbeddedPhotos: 5_000,
} as const;

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

  if (json.length > IMPORT_LIMITS.maxJsonChars) {
    issues.push({
      severity: 'error',
      message: 'This file is far larger than any backup NinniNest can produce. The import was stopped to protect your device.',
    });
    return fail();
  }

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

  // Collection bounds are checked on the RAW arrays before any validation so
  // an oversized archive fails fast instead of exercising the validators.
  const oversize: string[] = [];
  const checkCount = (label: string, arr: unknown, key: keyof typeof IMPORT_LIMITS.maxPerCollection) => {
    if (Array.isArray(arr) && arr.length > IMPORT_LIMITS.maxPerCollection[key]) {
      oversize.push(`${arr.length} ${label} (limit ${IMPORT_LIMITS.maxPerCollection[key]})`);
    }
  };
  checkCount('baby profile(s)', data.babies, 'babies');
  checkCount('journal event(s)', data.events, 'events');
  checkCount('active timer(s)', data.activeTimers, 'activeTimers');
  checkCount('growth record(s)', data.growthRecords, 'growthRecords');
  checkCount('milestone(s)', data.milestones, 'milestones');
  checkCount('medication(s)', data.medications, 'medications');
  checkCount('recorded dose(s)', data.medicationAdministrations, 'medicationAdministrations');
  checkCount('vaccination(s)', data.vaccinations, 'vaccinations');
  checkCount('routine(s)', data.routines, 'routines');
  if (Array.isArray(obj.photosEmbedded) && obj.photosEmbedded.length > IMPORT_LIMITS.maxEmbeddedPhotos) {
    oversize.push(`${obj.photosEmbedded.length} embedded photo(s) (limit ${IMPORT_LIMITS.maxEmbeddedPhotos})`);
  }
  if (oversize.length) {
    issues.push({
      severity: 'error',
      message: `This backup exceeds what one journal can hold: ${oversize.join(', ')}. The import was stopped to protect your device.`,
    });
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

  // Photos: verify every embedded payload against the integrity metadata its
  // own backup version promises, and require every manifest entry to reference
  // a real record under a safe file name. Nothing here writes.
  //   - v5 (hashAlgo 'sha256'): genuine SHA-256 of the decoded original bytes.
  //   - v4 and older (no hashAlgo): the legacy noncryptographic checksum over
  //     the base64 text. Its meaning is NEVER reinterpreted as a SHA-256.
  const embeddedRaw = Array.isArray(obj.photosEmbedded) ? (obj.photosEmbedded as EmbeddedPhoto[]) : [];
  const legacyRaw = Array.isArray(obj.photos) ? (obj.photos as EmbeddedPhoto[]) : [];
  const rawPhotos: EmbeddedPhoto[] = embeddedRaw.length > 0
    ? embeddedRaw
    : legacyRaw.filter((p) => p && typeof p.base64 === 'string');

  const validMilestonesForRefs = milestones.filter((m): m is NonNullable<typeof m> => m !== null);
  const babyIdsForRefs = new Set(validBabies.map((b) => b.id));
  const milestoneIdsForRefs = new Set(validMilestonesForRefs.map((m) => m.id));

  const photos: EmbeddedPhoto[] = [];
  const seenPhotoKeys = new Set<string>();
  let corruptPhotos = 0;
  let missingBytes = 0;
  let invalidRefs = 0;
  let duplicateRefs = 0;
  let unsafeNames = 0;
  let malformedPayloads = 0;
  let unsupportedAlgo = 0;
  let badIntegrityMeta = 0;
  // The verifier an entry must satisfy is decided by the file's own backup
  // version, never by what the entry claims alone: v5+ entries are
  // cryptographic (SHA-256 over decoded bytes, byte length required); v4 and
  // older use the legacy checksum and must NOT be reinterpreted as SHA-256.
  const isV5Plus = version >= 5;
  const SHA256_RE = /^[0-9a-f]{64}$/;
  for (const p of rawPhotos) {
    if (!p || typeof p !== 'object' || !p.recordId || !p.field) continue;
    const refOk =
      (p.field === 'babyPhoto' && babyIdsForRefs.has(p.recordId)) ||
      (p.field === 'milestonePhoto' && milestoneIdsForRefs.has(p.recordId));
    if (!refOk) {
      invalidRefs += 1;
      continue;
    }
    const key = `${p.recordId}:${p.field}`;
    if (seenPhotoKeys.has(key)) {
      duplicateRefs += 1;
      continue;
    }
    seenPhotoKeys.add(key);
    if (
      typeof p.fileName !== 'string' || !p.fileName.trim() ||
      p.fileName.includes('/') || p.fileName.includes('\\') || p.fileName.includes('..')
    ) {
      unsafeNames += 1;
      continue;
    }
    if (!p.base64) {
      missingBytes += 1;
      photos.push(p);
      continue;
    }

    // Entries claiming bytes must decode as canonical base64 before anything
    // else can be trusted.
    const decoded = decodeBase64Strict(p.base64);
    if (decoded === null) {
      malformedPayloads += 1;
      continue;
    }

    if (isV5Plus) {
      if (p.hashAlgo !== 'sha256') {
        // Absent, 'legacy-fnv' or anything else is an invalid combination on
        // v5 — the era of noncryptographic checksums is over.
        unsupportedAlgo += 1;
        continue;
      }
      if (typeof p.sha256 !== 'string' || !SHA256_RE.test(p.sha256)) {
        badIntegrityMeta += 1;
        continue;
      }
      if (typeof p.bytes !== 'number' || !Number.isInteger(p.bytes) || p.bytes < 0) {
        badIntegrityMeta += 1;
        continue;
      }
      if (decoded.length !== p.bytes || sha256Hex(decoded) !== p.sha256) {
        corruptPhotos += 1;
        continue;
      }
    } else {
      if (p.hashAlgo !== undefined && p.hashAlgo !== 'legacy-fnv') {
        // A v4 file cannot carry v5 semantics; never reinterpret its
        // checksum field as a cryptographic digest.
        unsupportedAlgo += 1;
        continue;
      }
      if (typeof p.sha256 !== 'string' || p.sha256.length === 0) {
        // Media bytes without ANY checksum cannot be verified — a malformed
        // or hand-edited archive, rejected rather than trusted.
        badIntegrityMeta += 1;
        continue;
      }
      if (hashContent(p.base64) !== p.sha256) {
        corruptPhotos += 1;
        continue;
      }
    }
    photos.push(p);
  }
  if (invalidRefs) {
    issues.push({
      severity: 'error',
      message: `${invalidRefs} embedded photo(s) reference records that are not in this backup. The import was stopped rather than attach media to the wrong record.`,
    });
  }
  if (duplicateRefs) {
    issues.push({
      severity: 'error',
      message: `${duplicateRefs} duplicate embedded photo entr${duplicateRefs === 1 ? 'y' : 'ies'} in the file. The import was stopped — conflicting media metadata cannot be applied safely.`,
    });
  }
  if (unsafeNames) {
    issues.push({
      severity: 'error',
      message: `${unsafeNames} embedded photo(s) have unsafe file names. The import was stopped rather than write outside the app's media area.`,
    });
  }
  if (malformedPayloads) {
    issues.push({
      severity: 'error',
      message: `${malformedPayloads} embedded photo(s) are not valid base64. The import was stopped rather than restore a payload that cannot be decoded exactly.`,
    });
  }
  if (unsupportedAlgo) {
    issues.push({
      severity: 'error',
      message: `${unsupportedAlgo} embedded photo(s) declare an integrity method that does not match this backup's version. The import was stopped rather than guess how to verify them.`,
    });
  }
  if (badIntegrityMeta) {
    issues.push({
      severity: 'error',
      message: `${badIntegrityMeta} embedded photo(s) have missing or malformed integrity metadata (digest or byte length). The import was stopped rather than trust unverifiable media.`,
    });
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
  if (obj.mediaComplete === false) {
    const missingCount = Array.isArray(obj.missingPhotos) ? obj.missingPhotos.length : 0;
    issues.push({
      severity: 'warning',
      message: `This backup is incomplete: ${missingCount} photo file(s) could not be read when it was exported.`,
    });
  }
  // Records that reference photos absent from the manifest (records-only or
  // partial backups). They import fine, but the images themselves are not in
  // the file — say so instead of leaving dangling references unexplained.
  const embeddedKeysWithBytes = new Set(
    photos.filter((p) => p.base64).map((p) => `${p.recordId}:${p.field}`)
  );
  const danglingPhotoRecords =
    validBabies.filter((b) => b.photoUri && !embeddedKeysWithBytes.has(`${b.id}:babyPhoto`)).length +
    validMilestonesForRefs.filter((m) => m.photoUri && !embeddedKeysWithBytes.has(`${m.id}:milestonePhoto`)).length;
  if (danglingPhotoRecords) {
    issues.push({
      severity: 'warning',
      message: `${danglingPhotoRecords} record(s) reference photos that are not embedded in this file. They will import without those photos.`,
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
      message: 'The import failed while writing. Please try again.',
    };
  }
}

export interface BackupImportDeps {
  restorePhotos: (photos: EmbeddedPhoto[]) => Promise<Map<string, string>>;
  refresh: () => Promise<void>;
}

// Full import workflow: database write first; media restoration runs only if
// the write succeeded. The returned string is the user-facing result message.
export async function runBackupImport(
  repo: { replaceAll(data: AppData): Promise<void> },
  plan: ImportPlan,
  deps: BackupImportDeps
): Promise<string> {
  const result = await applyImportPlan(repo, plan);
  if (!result.ok) return result.message;
  const restored = await deps.restorePhotos(plan.photos);
  await deps.refresh();
  return (
    result.message +
    (restored.size > 0
      ? ` ${restored.size} photo file(s) restored to the media library. Photo re-linking to records is not part of this restore.`
      : ' No embedded photos in this backup.')
  );
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
