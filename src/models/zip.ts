// Minimal STORED (uncompressed) ZIP writer — dependency-free so it runs in
// Hermes, browsers and the Node test runner alike. Used to bundle the CSV
// export into one shareable file: Android's share sheet cannot share a
// directory, and multiple sequential share dialogs would be hostile.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base && base !== '..' ? base : 'file';
}

export interface ZipEntry {
  name: string;
  content: Uint8Array;
}

/**
 * Builds a valid ZIP archive with one STORED entry per file. Entries carry
 * fixed DOS timestamps (1980-01-01): archive contents are deterministic for
 * identical inputs, which keeps tests and byte comparisons reproducible.
 */
export function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number): Uint8Array => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v: number): Uint8Array =>
    new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const concat = (parts: Uint8Array[]): Uint8Array => {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(safeName(entry.name));
    const crc = crc32(entry.content);
    const size = entry.content.length;

    const local = concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed
      u16(0), // flags
      u16(0), // method: stored
      u16(0), u16(0), // mod time/date (fixed)
      u32(crc),
      u32(size), // compressed
      u32(size), // uncompressed
      u16(nameBytes.length),
      u16(0), // extra length
      nameBytes,
      entry.content,
    ]);
    localParts.push(local);

    centralParts.push(
      concat([
        u32(0x02014b50), // central directory signature
        u16(20), u16(20), // versions
        u16(0), u16(0), // flags, method
        u16(0), u16(0), // time, date
        u32(crc),
        u32(size),
        u32(size),
        u16(nameBytes.length),
        u16(0), u16(0), u16(0), // extra, comment, disk
        u16(0), // internal attrs
        u32(0), // external attrs
        u32(offset), // local header offset
        nameBytes,
      ])
    );

    offset += local.length;
  }

  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50), // end of central directory
    u16(0), u16(0), // disk numbers
    u16(entries.length), u16(entries.length),
    u32(central.length),
    u32(offset),
    u16(0), // comment length
  ]);

  return concat([...localParts, central, end]);
}
