import type { AppData } from './types';
import type { ImportPlan } from './importPlan';
import type { MediaPort } from './mediaBackup';

export type { MediaPort };

/**
 * Staged, crash-recoverable backup restore.
 *
 * Ordering guarantees (the database and the file system CANNOT be committed as
 * one atomic transaction — SQLite and file writes have no shared transaction —
 * so the design is staged with bounded, documented recovery instead):
 *
 *   1. planImport has already validated the whole structure and every photo
 *      digest at plan time; this workflow aborts on a !ok plan.
 *   2. Any staging debris from a previous interrupted import is swept first
 *      (staged files are never referenced by any committed database state).
 *   3. Every photo payload is written into a quarantine area (.staging) and
 *      only then promoted into its final managed location — both BEFORE the
 *      database commit. Any staging/promotion failure aborts with the old
 *      database and old media untouched.
 *   4. The database commit is a single transactional replaceAll. If it fails,
 *      rollback deletes ONLY the files this import created; pre-existing media
 *      is never touched.
 *   5. If the process dies between promotion and commit, the promoted files are
 *      unreferenced orphans (unique names, inside per-baby managed dirs) that
 *      the existing per-baby orphan cleanup reclaims; staging debris is swept
 *      at the next import/launch. No committed state is ever inconsistent.
 */
export type RestoreOutcome =
  | 'complete'
  | 'incomplete-photos'
  | 'records-only'
  | 'validation-failed'
  | 'storage-failed'
  | 'rolled-back';

export interface StagedRestoreResult {
  ok: boolean;
  outcome: RestoreOutcome;
  restoredPhotos: number;
  /** Photo references the backup could not satisfy (no bytes / foreign URI). */
  failedPhotos: number;
}

const keyOf = (recordId: string, field: string): string => `${recordId}:${field}`;

export async function runStagedBackupImport(
  repo: { replaceAll(data: AppData): Promise<void> },
  plan: ImportPlan,
  deps: { media: MediaPort; refresh?: () => Promise<void>; current?: AppData }
): Promise<StagedRestoreResult> {
  if (!plan.ok || !plan.target) {
    return { ok: false, outcome: 'validation-failed', restoredPhotos: 0, failedPhotos: 0 };
  }

  // Recovery sweep: debris from an interrupted earlier import is never
  // referenced by any committed state, so it is always safe to remove.
  try {
    await deps.media.wipeStaging();
  } catch {
    // best-effort; staging failures surface in the stage() calls below
  }

  const target = plan.target;
  const milestoneOwner = new Map(target.milestones.map((m) => [m.id, m.babyId]));
  // Records this device already has (merge mode): they stay exactly as they
  // are — merge adds new records, it never overwrites local ones, including
  // their photos.
  const currentBabyIds = new Set((deps.current?.babies ?? []).map((b) => b.id));
  const currentMilestoneIds = new Set((deps.current?.milestones ?? []).map((m) => m.id));
  const mergeKept = (recordId: string, field: 'babyPhoto' | 'milestonePhoto') =>
    plan.mode === 'merge' &&
    (field === 'babyPhoto' ? currentBabyIds.has(recordId) : currentMilestoneIds.has(recordId));

  const withBytes = plan.photos.filter((p) => p.base64);

  // 3a. Quarantine every payload. Any failure aborts BEFORE the database.
  //     Merge-kept records already have their media on this device; their
  //     embedded copies are neither staged nor promoted.
  try {
    for (const p of withBytes) {
      if (mergeKept(p.recordId, p.field)) continue;
      await deps.media.stage({
        key: keyOf(p.recordId, p.field),
        ownerBabyId: p.field === 'babyPhoto' ? p.recordId : milestoneOwner.get(p.recordId) ?? p.recordId,
        base64: p.base64!,
        fileName: p.fileName,
      });
    }
  } catch {
    await deps.media.rollback().catch(() => {});
    return { ok: false, outcome: 'storage-failed', restoredPhotos: 0, failedPhotos: plan.photos.length };
  }

  // 3b. Promote into final managed locations — still before the DB commit.
  let uriByKey: Map<string, string>;
  try {
    uriByKey = await deps.media.promoteAll();
  } catch {
    await deps.media.rollback().catch(() => {});
    return { ok: false, outcome: 'storage-failed', restoredPhotos: 0, failedPhotos: plan.photos.length };
  }

  // Remap records onto the promoted files, and handle references the backup
  // could not satisfy: a URI pointing at the exporting device's files would
  // render a broken image forever on this device. Cleared honestly instead —
  // but only for records new to this device (merge-kept records are untouched).
  const restored = { ...target };
  let clearedDangling = 0;
  const clearIfDangling = <T extends { id: string; photoUri?: string; isDemo?: boolean }>(
    record: T,
    field: 'babyPhoto' | 'milestonePhoto'
  ): T => {
    if (mergeKept(record.id, field)) return record;
    const restoredUri = uriByKey.get(keyOf(record.id, field));
    if (restoredUri) return { ...record, photoUri: restoredUri };
    const isNewToDevice = plan.mode === 'replace' || !deps.media.isManagedUri(record.photoUri ?? '');
    if (record.photoUri && isNewToDevice) {
      clearedDangling += 1;
      return { ...record, photoUri: undefined };
    }
    return record;
  };
  restored.babies = target.babies.map((b) => clearIfDangling(b, 'babyPhoto'));
  restored.milestones = target.milestones.map((m) => clearIfDangling(m, 'milestonePhoto'));

  // 4. Single transactional database commit. Failure removes only this
  //    import's files; the previous database and media stay byte-identical.
  try {
    await repo.replaceAll(restored);
  } catch {
    await deps.media.rollback().catch(() => {});
    return { ok: false, outcome: 'rolled-back', restoredPhotos: 0, failedPhotos: plan.photos.length };
  }

  try {
    await deps.refresh?.();
  } catch {
    // refresh failure must not turn a committed import into a reported failure
  }

  const restoredPhotos = uriByKey.size;
  const unsatisfiedWithoutBytes = plan.photos.filter(
    (p) => !p.base64 && !mergeKept(p.recordId, p.field)
  ).length;
  const failedPhotos = unsatisfiedWithoutBytes + clearedDangling;
  const outcome: RestoreOutcome =
    restoredPhotos === 0 && plan.photos.length === 0
      ? 'records-only'
      : failedPhotos > 0
        ? 'incomplete-photos'
        : 'complete';
  return { ok: true, outcome, restoredPhotos, failedPhotos };
}

/**
 * Launch-time recovery sweep. Staged debris from a killed import is never
 * referenced by the committed database, so wiping it is unconditionally safe;
 * promoted-but-uncommitted files are unique-named orphans reclaimed by the
 * existing per-baby orphan cleanup. Errors are swallowed — recovery must never
 * block app start.
 */
export async function sweepImportStaging(media: MediaPort): Promise<void> {
  try {
    await media.wipeStaging();
  } catch {
    // never block startup on recovery
  }
}
