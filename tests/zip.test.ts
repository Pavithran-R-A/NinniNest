import { describe, it, expect } from 'vitest';
import { createZip } from '../src/models/zip';

const text = (s: string) => new TextEncoder().encode(s);

/** Minimal stored-zip reader used to verify what createZip produced. */
function readZip(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => dv.getUint16(o, true);
  const u32 = (o: number) => dv.getUint32(o, true);
  const entries: { name: string; data: Uint8Array; crc32: number; method: number }[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const sig = u32(offset);
    if (sig === 0x04034b50) {
      const method = u16(offset + 8);
      const crc32 = u32(offset + 14);
      const compressedSize = u32(offset + 18);
      const nameLen = u16(offset + 26);
      const extraLen = u16(offset + 28);
      const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
      const dataStart = offset + 30 + nameLen + extraLen;
      entries.push({ name, data: bytes.slice(dataStart, dataStart + compressedSize), crc32, method });
      offset = dataStart + compressedSize;
    } else {
      break; // central directory reached
    }
  }
  // walk the central directory and stop at the end record
  expect(u32(offset)).toBe(0x02014b50);
  let centralCount = 0;
  while (offset < bytes.length && u32(offset) === 0x02014b50) {
    centralCount += 1;
    const nameLen = u16(offset + 28);
    const extraLen = u16(offset + 30);
    const commentLen = u16(offset + 32);
    offset += 46 + nameLen + extraLen + commentLen;
  }
  expect(u32(offset)).toBe(0x06054b50); // end of central directory
  return { entries, centralCount };
}

describe('createZip (stored, no-dependency archive for CSV bundles)', () => {
  it('produces a structurally valid zip with exact file contents', () => {
    const zip = createZip([
      { name: 'care-history.csv', content: text('id,babyId\n1,2\n') },
      { name: 'growth.csv', content: text('id,grams\n3,4000\n') },
    ]);
    const { entries, centralCount } = readZip(zip);
    expect(centralCount).toBe(2);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('care-history.csv');
    expect(entries[0].method).toBe(0); // stored
    expect(new TextDecoder().decode(entries[0].data)).toBe('id,babyId\n1,2\n');
    expect(new TextDecoder().decode(entries[1].data)).toBe('id,grams\n3,4000\n');
  });

  it('writes CRC-32 values matching the payload (spot-checked against the standard vector)', () => {
    // CRC-32 of "123456789" is 0xCBF43926 (standard check vector).
    const zip = createZip([{ name: 'a.txt', content: text('123456789') }]);
    const { entries } = readZip(zip);
    expect(entries[0].crc32).toBe(0xcbf43926);
  });

  it('handles empty payloads and preserves binary bytes', () => {
    const binary = new Uint8Array(256);
    for (let i = 0; i < 256; i++) binary[i] = i;
    const zip = createZip([
      { name: 'empty.csv', content: new Uint8Array(0) },
      { name: 'bin.bin', content: binary },
    ]);
    const { entries } = readZip(zip);
    expect(new TextDecoder().decode(entries[0].data)).toBe('');
    expect(entries[1].data).toEqual(binary);
  });

  it('never lets a filename carry path separators into the archive', () => {
    const zip = createZip([{ name: '../../evil.csv', content: text('x') }]);
    const { entries } = readZip(zip);
    expect(entries[0].name).toBe('evil.csv');
  });
});
