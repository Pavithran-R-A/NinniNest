import { describe, it, expect, vi } from 'vitest';
import { persistRecordWithPhoto, type PhotoWorkflowIo } from '../src/models/photoPersist';
import type { Baby } from '../src/models/types';

const BABY: Baby = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Aru',
  birthDate: '2026-08-14',
  createdAt: '2026-10-01T08:00:00.000Z',
};

const PICKER_URI = 'file:///cache/picker-tmp.jpg';
const MANAGED_NEW = 'file:///managed/a1/new.jpg';
const MANAGED_OLD = 'file:///managed/a1/old.jpg';

function createIo(opts: { failCopy?: boolean } = {}) {
  const log: string[] = [];
  const deleted: string[] = [];
  const io: PhotoWorkflowIo & { log: string[]; deleted: string[] } = {
    log,
    deleted,
    async importPhoto(sourceUri, babyId) {
      if (opts.failCopy) throw new Error('simulated: copy failed');
      log.push(`import:${babyId}`);
      return MANAGED_NEW;
    },
    async deleteManagedPhoto(uri) {
      if (!uri) return;
      log.push(`delete:${uri}`);
      deleted.push(uri);
    },
  };
  return io;
}

describe('persistRecordWithPhoto (baby/milestone photo durability)', () => {
  it('create: copies the picker file into managed storage BEFORE persisting', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; });
    const result = await persistRecordWithPhoto(
      io,
      { record: { ...BABY, photoUri: PICKER_URI }, babyId: BABY.id, pendingPhotoUri: PICKER_URI, isNew: true },
      persist
    );
    expect(result.ok).toBe(true);
    expect(result.persistedUri).toBe(MANAGED_NEW);
    // the record that reached storage references the MANAGED copy, never the picker URI
    expect(persist.mock.calls[0][0].photoUri).toBe(MANAGED_NEW);
    expect(io.log[0]).toBe(`import:${BABY.id}`);
    expect(io.deleted).toHaveLength(0);
  });

  it('create: copy failure persists nothing and touches no existing media', async () => {
    const io = createIo({ failCopy: true });
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; });
    const result = await persistRecordWithPhoto(
      io,
      { record: { ...BABY, photoUri: PICKER_URI }, babyId: BABY.id, pendingPhotoUri: PICKER_URI, isNew: true },
      persist
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('copy-failed');
    expect(persist).not.toHaveBeenCalled();
    expect(io.deleted).toHaveLength(0);
  });

  it('create: database failure removes ONLY the newly copied file', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return false; });
    const result = await persistRecordWithPhoto(
      io,
      { record: { ...BABY, photoUri: PICKER_URI }, babyId: BABY.id, pendingPhotoUri: PICKER_URI, isNew: true },
      persist
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('save-failed');
    expect(io.deleted).toEqual([MANAGED_NEW]);
  });

  it('edit-replace: the previous photo is deleted only AFTER the record commits', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; });
    const result = await persistRecordWithPhoto(
      io,
      {
        record: { ...BABY, photoUri: PICKER_URI },
        babyId: BABY.id,
        pendingPhotoUri: PICKER_URI,
        previousPhotoUri: MANAGED_OLD,
        isNew: false,
      },
      persist
    );
    expect(result.ok).toBe(true);
    // order: import -> persist -> delete-previous
    expect(io.log).toEqual([`import:${BABY.id}`, 'persist', `delete:${MANAGED_OLD}`]);
  });

  it('edit-replace: database failure keeps the previous photo and removes only the new copy', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return false; });
    const result = await persistRecordWithPhoto(
      io,
      {
        record: { ...BABY, photoUri: PICKER_URI },
        babyId: BABY.id,
        pendingPhotoUri: PICKER_URI,
        previousPhotoUri: MANAGED_OLD,
        isNew: false,
      },
      persist
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('save-failed');
    expect(io.deleted).toEqual([MANAGED_NEW]); // previous photo untouched
  });

  it('edit-replace: same managed URI (no effective change) never deletes the file', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; });
    await persistRecordWithPhoto(
      io,
      {
        record: { ...BABY, photoUri: PICKER_URI },
        babyId: BABY.id,
        pendingPhotoUri: PICKER_URI,
        previousPhotoUri: MANAGED_NEW,
        isNew: false,
      },
      persist
    );
    expect(io.deleted).toHaveLength(0);
  });

  it('removal: the previous photo is deleted only after a successful commit', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; });
    const result = await persistRecordWithPhoto(
      io,
      { record: { ...BABY }, babyId: BABY.id, removePhoto: true, previousPhotoUri: MANAGED_OLD, isNew: false },
      persist
    );
    expect(result.ok).toBe(true);
    expect(persist.mock.calls[0][0].photoUri).toBeUndefined();
    expect(io.log).toEqual(['persist', `delete:${MANAGED_OLD}`]);
  });

  it('removal: a failed commit keeps the previous photo file', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return false; });
    const result = await persistRecordWithPhoto(
      io,
      { record: { ...BABY }, babyId: BABY.id, removePhoto: true, previousPhotoUri: MANAGED_OLD, isNew: false },
      persist
    );
    expect(result.ok).toBe(false);
    expect(io.deleted).toHaveLength(0);
  });

  it('no photo change on edit: persists the existing URI and deletes nothing', async () => {
    const io = createIo();
    const persist = vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; });
    const result = await persistRecordWithPhoto(
      io,
      { record: { ...BABY, photoUri: MANAGED_OLD }, babyId: BABY.id, isNew: false },
      persist
    );
    expect(result.ok).toBe(true);
    expect(result.persistedUri).toBeUndefined();
    expect(persist.mock.calls[0][0].photoUri).toBe(MANAGED_OLD);
    expect(io.log).toEqual(['persist']);
  });

  it('multiple babies: each import is scoped to its own baby id', async () => {
    const io = createIo();
    const b2: Baby = { ...BABY, id: 'a0000000-0000-4000-8000-000000000002', name: 'Ini' };
    await persistRecordWithPhoto(
      io,
      { record: { ...BABY, photoUri: PICKER_URI }, babyId: BABY.id, pendingPhotoUri: PICKER_URI, isNew: true },
      vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; })
    );
    await persistRecordWithPhoto(
      io,
      { record: { ...b2, photoUri: PICKER_URI }, babyId: b2.id, pendingPhotoUri: PICKER_URI, isNew: true },
      vi.fn(async (_r: Baby) => { io.log.push('persist'); return true; })
    );
    expect(io.log.filter((l) => l.startsWith('import:'))).toEqual([`import:${BABY.id}`, `import:${b2.id}`]);
  });

  it('web-style io (import returns the picker URI as-is) persists it without deletions', async () => {
    const io: PhotoWorkflowIo = {
      async importPhoto(sourceUri) {
        return sourceUri; // media.ts web behaviour: durability is not possible
      },
      async deleteManagedPhoto() {},
    };
    const persist = vi.fn(async (_r: Baby) => true);
    const result = await persistRecordWithPhoto(
      io,
      { record: { ...BABY, photoUri: PICKER_URI }, babyId: BABY.id, pendingPhotoUri: PICKER_URI, isNew: true },
      persist
    );
    expect(result.ok).toBe(true);
    expect(persist.mock.calls[0][0].photoUri).toBe(PICKER_URI);
  });
});
