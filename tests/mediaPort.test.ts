import { describe, it, expect } from 'vitest';
import { createManagedMediaPort, type MediaPortIo } from '../src/models/mediaBackup';

// ---------------------------------------------------------------------------
// Fake filesystem primitives with failure injection. These drive the REAL
// createManagedMediaPort state machine — the same code the native
// expo-file-system port runs — not a parallel test substitute.
// ---------------------------------------------------------------------------

interface FakeFile {
  path: string;
  bytes: Uint8Array;
  preExisting: boolean;
}

function createFakeIo(opts: {
  failWriteFor?: string[]; // path fragments
  failCopyFor?: string[];
  failRemoveFor?: string[];
} = {}) {
  const files = new Map<string, FakeFile>();
  const dirs = new Set<string>().add('/root').add('/root/.staging');
  const removed: string[] = [];
  let idCounter = 0;
  const io: MediaPortIo & {
    files: Map<string, FakeFile>;
    removed: string[];
    seedFile(path: string, bytes: Uint8Array): void;
  } = {
    files,
    removed,
    seedFile(path, bytes) {
      files.set(path, { path, bytes, preExisting: true });
      dirs.add(path.split('/').slice(0, -1).join('/') || '/root');
    },
    nowMs: () => 1700000000000,
    randomId: () => `id${(idCounter += 1).toString(36)}`, // unique per call
    joinPath: (base, name) => `${base}/${name}`,
    baseName: (p) => p.split('/').pop() ?? p,
    async ensureDir(path) {
      dirs.add(path);
    },
    async writeFile(path, bytes) {
      if (opts.failWriteFor?.some((f) => path.includes(f))) throw new Error('simulated write failure');
      files.set(path, { path, bytes, preExisting: false });
    },
    async copyFile(src, dest) {
      if (opts.failCopyFor?.some((f) => dest.includes(f) || src.includes(f))) throw new Error('simulated copy failure');
      const s = files.get(src);
      if (!s) throw new Error('missing source');
      files.set(dest, { path: dest, bytes: s.bytes, preExisting: false });
    },

    async removeFile(path) {
      removed.push(path); // attempt log: rollback must reach even absent files
      if (opts.failRemoveFor?.some((f) => path.includes(f))) throw new Error('simulated remove failure');
      if (!files.has(path)) return; // absent is fine
      files.delete(path);
    },
    async fileExists(path) {
      return files.has(path);
    },
    async listChildDirs(base) {
      return [...dirs].filter((d) => d !== base && d.startsWith(`${base}/`) && !d.slice(base.length + 1).includes('/'));
    },
    async listChildFiles(base) {
      return [...files.keys()].filter((f) => f.startsWith(`${base}/`) && !f.slice(base.length + 1).includes('/'));
    },
    async removeTree(path) {
      for (const key of [...files.keys()]) if (key.startsWith(`${path}/`)) files.delete(key);
      for (const d of [...dirs]) if (d === path || d.startsWith(`${path}/`)) dirs.delete(d);
    },
    rootPath: () => '/root',
    stagingPath: () => '/root/.staging',
  };
  return io;
}

const BYTES = new TextEncoder().encode('port-bytes');
const B64 = Buffer.from(BYTES).toString('base64');

describe('createManagedMediaPort: staging discipline', () => {
  it('tracks a staged file BEFORE the fallible write, so a failed write is still rolled back', async () => {
    const io = createFakeIo({ failWriteFor: ['.staging'] });
    const port = createManagedMediaPort(io);
    await expect(
      port.stage({ key: 'b1:babyPhoto', ownerBabyId: 'b1', base64: B64, fileName: 'p.jpg' })
    ).rejects.toThrow('simulated write failure');
    // the workflow's rollback must reach the partially written file
    const failures = await port.rollback();
    expect(io.removed).toHaveLength(1);
    expect(io.removed[0]).toContain('/root/.staging/');
    expect(failures).toBe(0);
  });

  it('never reuses a staged or promoted path within the same import', async () => {
    const io = createFakeIo();
    const port = createManagedMediaPort(io);
    await port.stage({ key: 'k1', ownerBabyId: 'b1', base64: B64, fileName: 'same.jpg' });
    await port.stage({ key: 'k2', ownerBabyId: 'b1', base64: B64, fileName: 'same.jpg' });
    const uris = await port.promoteAll();
    expect(uris.get('k1')).not.toBe(uris.get('k2'));
    expect(new Set(io.files.keys()).size).toBe(2); // no overwrite collision
  });

  it('sanitizes the owner segment so a hostile id cannot escape the media root', async () => {
    const io = createFakeIo();
    const port = createManagedMediaPort(io);
    await port.stage({ key: 'k', ownerBabyId: '../../evil', base64: B64, fileName: 'p.jpg' });
    await port.promoteAll();
    const paths = [...io.files.keys()];
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^\/root\/evil\//); // flattened under the root, never outside it
  });
});

describe('createManagedMediaPort: promotion and rollback', () => {
  it('on mid-promotion failure, rollback removes both copies of promoted files and the staged ones', async () => {
    const io = createFakeIo({ failCopyFor: ['-2.jpg'] }); // second file's copy fails
    const port = createManagedMediaPort(io);
    await port.stage({ key: 'k1', ownerBabyId: 'b1', base64: B64, fileName: '1.jpg' });
    await port.stage({ key: 'k2', ownerBabyId: 'b1', base64: B64, fileName: '2.jpg' });
    await expect(port.promoteAll()).rejects.toThrow('simulated copy failure');
    const failures = await port.rollback();
    expect(failures).toBe(0);
    expect(io.files.size).toBe(0); // nothing of this import survives
  });

  it('rollback counts files it could not delete and still removes the rest', async () => {
    const io = createFakeIo({ failRemoveFor: ['.staging'] });
    const port = createManagedMediaPort(io);
    await port.stage({ key: 'k', ownerBabyId: 'b1', base64: B64, fileName: 'p.jpg' });
    const failures = await port.rollback();
    expect(failures).toBe(1);
  });

  it('rollback never touches files this import did not create', async () => {
    const io = createFakeIo();
    const keep = new TextEncoder().encode('precious');
    io.seedFile('/root/b1/pre-existing.jpg', keep);
    const port = createManagedMediaPort(io);
    await port.stage({ key: 'k', ownerBabyId: 'b1', base64: B64, fileName: 'p.jpg' });
    await port.rollback();
    expect(io.files.get('/root/b1/pre-existing.jpg')?.bytes).toEqual(keep);
    expect(io.removed.every((p) => p.includes('/root/.staging/'))).toBe(true);
  });

  it('wipeStaging clears the staging area only, never per-baby media', async () => {
    const io = createFakeIo();
    io.seedFile('/root/b1/photo.jpg', BYTES);
    const port = createManagedMediaPort(io);
    await port.stage({ key: 'k', ownerBabyId: 'b1', base64: B64, fileName: 'p.jpg' });
    await port.wipeStaging();
    expect(io.files.has('/root/b1/photo.jpg')).toBe(true);
    expect([...io.files.keys()].some((p) => p.includes('.staging'))).toBe(false);
  });
});

describe('createManagedMediaPort: post-import media hygiene', () => {
  it('cleanupBabyFiles removes only unreferenced files in that baby directory', async () => {
    const io = createFakeIo();
    io.seedFile('/root/b1/old.jpg', BYTES);
    io.seedFile('/root/b1/current.jpg', BYTES);
    io.seedFile('/root/b2/other-baby.jpg', BYTES);
    const port = createManagedMediaPort(io);
    const result = await port.cleanupBabyFiles('b1', new Set(['/root/b1/current.jpg']));
    expect(result.removed).toBe(1);
    expect(result.failures).toBe(0);
    expect(io.files.has('/root/b1/current.jpg')).toBe(true);
    expect(io.files.has('/root/b2/other-baby.jpg')).toBe(true);
    expect(io.files.has('/root/b1/old.jpg')).toBe(false);
  });

  it('cleanup failures are counted, not silent', async () => {
    const io = createFakeIo({ failRemoveFor: ['old.jpg'] });
    io.seedFile('/root/b1/old.jpg', BYTES);
    const port = createManagedMediaPort(io);
    const result = await port.cleanupBabyFiles('b1', new Set<string>());
    expect(result.removed).toBe(0);
    expect(result.failures).toBe(1);
    // the file remains; the count tells the caller cleanup is incomplete
    expect(io.files.has('/root/b1/old.jpg')).toBe(true);
  });

  it('listManagedBabyIds exposes only baby directories, never .staging', async () => {
    const io = createFakeIo();
    io.seedFile('/root/b1/x.jpg', BYTES);
    io.seedFile('/root/.staging/debris.bin', BYTES);
    const port = createManagedMediaPort(io);
    expect(await port.listManagedBabyIds()).toEqual(['b1']);
  });

  it('deleteBabyDirectory removes that baby directory and reports failures', async () => {
    const io = createFakeIo();
    io.seedFile('/root/b1/a.jpg', BYTES);
    io.seedFile('/root/b1/b.jpg', BYTES);
    io.seedFile('/root/b2/c.jpg', BYTES);
    const port = createManagedMediaPort(io);
    const failures = await port.deleteBabyDirectory('b1');
    expect(failures).toBe(0);
    expect(io.files.has('/root/b2/c.jpg')).toBe(true);
    expect(io.files.has('/root/b1/a.jpg')).toBe(false);

    const failingIo = createFakeIo({ failRemoveFor: ['b1'] });
    failingIo.seedFile('/root/b1/doomed.jpg', BYTES);
    const failing = createManagedMediaPort(failingIo);
    expect(await failing.deleteBabyDirectory('b1')).toBeGreaterThan(0);
  });
});
