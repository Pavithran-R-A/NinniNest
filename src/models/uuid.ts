/**
 * Cross-runtime UUID v4 generation.
 *
 * Browsers expose crypto.randomUUID; Hermes (Android/iOS JS runtime) does
 * NOT ship WebCrypto's randomUUID and the project has no crypto polyfill
 * package — record creation on native would throw a silent TypeError the
 * moment any id was generated (found in the first real device run, 0.9.0).
 * The fallback below builds an RFC-4122 v4 UUID from the strongest source
 * available (crypto.getRandomValues when present, otherwise Math.random).
 * These ids key local rows only — they are identifiers, not secrets.
 */
interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (a: Uint8Array) => Uint8Array;
}

export function uuid(
  source: CryptoLike | undefined = (globalThis as { crypto?: CryptoLike }).crypto
): string {
  if (source && typeof source.randomUUID === 'function') return source.randomUUID();

  const bytes = new Uint8Array(16);
  if (source && typeof source.getRandomValues === 'function') {
    source.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
