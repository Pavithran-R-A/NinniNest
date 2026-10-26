import { describe, it, expect } from 'vitest';
import { uuid } from '../src/models/uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid (cross-runtime id generation)', () => {
  it('generates valid RFC-4122 v4 UUIDs in the test runtime (WebCrypto path)', () => {
    const ids = Array.from({ length: 50 }, () => uuid());
    for (const id of ids) expect(id).toMatch(UUID_RE);
    expect(new Set(ids).size).toBe(50);
  });

  it('falls back to Math.random when no WebCrypto exists (Hermes case)', () => {
    const id = uuid(undefined);
    expect(id).toMatch(UUID_RE);
  });

  it('uses getRandomValues when randomUUID is missing but getRandomValues exists', () => {
    const seen: Uint8Array[] = [];
    const id = uuid({
      getRandomValues: (a: Uint8Array) => {
        seen.push(a);
        for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256;
        return a;
      },
    });
    expect(id).toMatch(UUID_RE);
    expect(seen).toHaveLength(1);
  });
});
