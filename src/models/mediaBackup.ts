import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import type { BackupFile, PhotoManifestEntry } from './backup';
import { buildBackup } from './backup';
import { hashContent } from './hash';
import type { AppData, MilestoneRecord } from './types';

export { hashContent };

export interface EmbeddedPhoto {
  recordId: string;
  field: 'babyPhoto' | 'milestonePhoto';
  fileName: string;
  base64?: string; // empty/absent when the file could not be read
  sha256?: string;
  bytes?: number;
}

export interface FullBackup extends BackupFile {
  photosEmbedded: EmbeddedPhoto[];
}

// Simple deterministic hash (see hash.ts) for media integrity comparison.

async function fileBase64(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const f = new File(uri);
    if (!f.exists) return null;
    const bytes = await f.bytes();
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

// Collects all referenced media files and embeds their bytes into the backup.
// A JSON file alone is NOT a complete backup; this archive is.
export async function buildFullBackup(data: AppData, settings?: { themeMode?: string }): Promise<FullBackup> {
  const base = buildBackup(data, settings);
  const photosEmbedded: EmbeddedPhoto[] = [];
  if (Platform.OS !== 'web') {
    const managedRoot = new Directory(Paths.document, 'ninninest-media').uri;
    const collect = async (uri: string | undefined, recordId: string, field: PhotoManifestEntry['field']) => {
      if (!uri || !uri.startsWith(managedRoot)) return;
      const base64 = await fileBase64(uri);
      if (base64 === null) return;
      photosEmbedded.push({
        recordId,
        field,
        fileName: uri.split('/').pop() ?? 'photo',
        base64,
        sha256: hashContent(base64),
        bytes: base64.length,
      });
    };
    for (const baby of data.babies) {
      await collect(baby.photoUri, baby.id, 'babyPhoto');
    }
    for (const m of data.milestones) {
      await collect(m.photoUri, m.id, 'milestonePhoto');
    }
  }
  return { ...base, photosEmbedded };
}

// Restores embedded photos into the managed media directory and returns a map
// of recordId:field -> restored file URI. A payload whose hash does not match
// its recorded sha256 is never written. Failures per-file never abort the rest.
export async function restoreEmbeddedPhotos(
  photos: EmbeddedPhoto[]
): Promise<Map<string, string>> {
  const restored = new Map<string, string>();
  if (Platform.OS === 'web') return restored;
  const mediaRoot = new Directory(Paths.document, 'ninninest-media');
  for (const p of photos) {
    if (!p.base64) continue;
    if (p.sha256 && hashContent(p.base64) !== p.sha256) continue; // corrupted payload — skip
    try {
      const dir = new Directory(mediaRoot, p.recordId);
      dir.create({ intermediates: true, idempotent: true });
      const file = new File(dir, p.fileName);
      const binary = atob(p.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await file.write(bytes);
      restored.set(`${p.recordId}:${p.field}`, file.uri);
    } catch {
      // skip individual photo failures
    }
  }
  return restored;
}

// Point records at the restored files. Only records that still have a photo
// field (or had one before export) receive a URI, so restored media can never
// attach to the wrong record.
export function remapEmbeddedPhotos(
  data: AppData,
  milestones: MilestoneRecord[],
  restored: Map<string, string>
): { data: AppData; milestones: MilestoneRecord[] } {
  const babies = data.babies.map((b) => {
    const uri = restored.get(`${b.id}:babyPhoto`);
    return uri ? { ...b, photoUri: uri } : b;
  });
  const remappedMilestones = milestones.map((m) => {
    const uri = restored.get(`${m.id}:milestonePhoto`);
    return uri ? { ...m, photoUri: uri } : m;
  });
  return { data: { ...data, babies }, milestones: remappedMilestones };
}
