import type { Baby, MilestoneRecord } from './types';

/**
 * Photo durability workflow for baby and milestone records.
 *
 * Ordering guarantees (the file copy and the database write cannot be one
 * atomic transaction, so the ordering is chosen so nothing is ever lost):
 *   1. a freshly picked photo is COPIED into managed storage first — the
 *      picker URI lives in cache the OS may reclaim, so it must never be
 *      persisted;
 *   2. only then is the record written, referencing the managed copy;
 *   3. the PREVIOUS photo file is deleted only AFTER a successful commit —
 *      a failed save can never destroy the photo that is still on record;
 *   4. on any failure only files THIS operation created are removed.
 */

export interface PhotoWorkflowIo {
  /** Copy a source URI into managed storage for this baby; returns the managed URI. */
  importPhoto(sourceUri: string, babyId: string): Promise<string>;
  /** Delete a managed photo file (no-op for foreign/absent URIs). */
  deleteManagedPhoto(uri: string | undefined): Promise<void>;
}

export interface PhotoSaveOutcome {
  ok: boolean;
  /** The URI that ended up persisted (present on success when a photo is involved). */
  persistedUri?: string;
  error?: 'copy-failed' | 'save-failed';
}

interface PersistArgs<T> {
  /** The record as it should be saved, with any photo field already resolved except pending copy/removal. */
  record: T;
  /** Owner baby id: the record id for babies, the babyId for milestones. */
  babyId: string;
  /** A freshly picked photo (picker/cache URI) that must be copied before persisting. */
  pendingPhotoUri?: string;
  /** Explicit removal request (edits): clear the field and delete the old file after commit. */
  removePhoto?: boolean;
  /** The currently persisted managed URI (edits only). */
  previousPhotoUri?: string;
  isNew: boolean;
}

export async function persistRecordWithPhoto<T extends { photoUri?: string }>(
  io: PhotoWorkflowIo,
  args: PersistArgs<T>,
  persist: (record: T) => Promise<boolean>
): Promise<PhotoSaveOutcome> {
  const { record, babyId, pendingPhotoUri, removePhoto, previousPhotoUri, isNew } = args;

  // Removal request: commit the cleared record first, then reclaim the file.
  if (removePhoto && !pendingPhotoUri) {
    const cleared = { ...record, photoUri: undefined } as T;
    if (!(await persist(cleared))) return { ok: false, error: 'save-failed' };
    await io.deleteManagedPhoto(previousPhotoUri);
    return { ok: true };
  }

  // New photo: copy out of the picker's temporary location BEFORE persisting.
  if (pendingPhotoUri) {
    let managedUri: string;
    try {
      managedUri = await io.importPhoto(pendingPhotoUri, babyId);
    } catch {
      return { ok: false, error: 'copy-failed' };
    }
    if (!(await persist({ ...record, photoUri: managedUri }))) {
      // Roll back only the file this operation created. The previous photo
      // (if any) is still the one on record and must survive.
      await io.deleteManagedPhoto(managedUri).catch(() => {});
      return { ok: false, error: 'save-failed' };
    }
    if (!isNew && previousPhotoUri && previousPhotoUri !== managedUri) {
      await io.deleteManagedPhoto(previousPhotoUri).catch(() => {});
    }
    return { ok: true, persistedUri: managedUri };
  }

  // No photo change: persist as-is (existing URI flows through untouched).
  if (!(await persist(record))) return { ok: false, error: 'save-failed' };
  return { ok: true, persistedUri: isNew ? record.photoUri : undefined };
}

export type PhotoRecord = Baby | MilestoneRecord;
