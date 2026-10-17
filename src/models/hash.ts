// Deterministic content hash used for backup media integrity. Kept dependency-free
// so it runs in plain Node test environments.
export function hashContent(content: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = (h1 * 16777619) >>> 0;
    h2 = (h2 + c * (i + 7)) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}
