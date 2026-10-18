// Minimal shape-compatible stub: Paths.document points at an unreachable
// location, so `fileBase64` sees files as absent and writes throw — the tests
// then assert against the "media unavailable" code paths.
export class File {
  constructor(_base: unknown, _name?: string) {}
  get exists(): boolean {
    return false;
  }
  get uri(): string {
    return 'file:///stub-unavailable';
  }
  async bytes(): Promise<Uint8Array> {
    throw new Error('stub: file system unavailable');
  }
  async write(_data: Uint8Array | string): Promise<void> {
    throw new Error('stub: file system unavailable');
  }
}

export class Directory {
  constructor(_base: unknown, _name?: string) {}
  get uri(): string {
    return 'file:///stub-unavailable';
  }
  create(_opts?: unknown): void {
    throw new Error('stub: file system unavailable');
  }
}

export const Paths = {
  document: 'file:///stub-documents',
};
