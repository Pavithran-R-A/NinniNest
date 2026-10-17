import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import type { Baby, MilestoneRecord } from './types';

const MEDIA_DIR_NAME = 'ninninest-media';

function mediaRoot(): Directory {
  return new Directory(Paths.document, MEDIA_DIR_NAME);
}

function babyDir(babyId: string): Directory {
  return new Directory(mediaRoot(), babyId);
}

function extensionOf(uri: string): string {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(uri.split('?')[0] ?? '');
  return m ? m[1].toLowerCase() : 'jpg';
}

// Copies a picker URI into durable app-managed storage and returns the new URI.
// Picker results live in cache/tmp that the OS may reclaim, so referencing them
// directly would lose the photo after a few days.
export async function importPhoto(sourceUri: string, babyId: string): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;
  const dir = babyDir(babyId);
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionOf(sourceUri)}`);
  await new File(sourceUri).copy(dest);
  return dest.uri;
}

export async function deletePhotoIfInManagedDir(uri: string | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  if (!uri.startsWith(mediaRoot().uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // A missing file must not block record deletion.
  }
}

// Removes media files that no record references anymore. Only ever touches the
// managed directory of one baby, so another baby's photos are unreachable.
export async function cleanupOrphansForBaby(
  babyId: string,
  referencedUris: Set<string>
): Promise<void> {
  if (Platform.OS === 'web') return;
  const dir = babyDir(babyId);
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    if (entry instanceof File && !referencedUris.has(entry.uri)) {
      try {
        entry.delete();
      } catch {
        // ignore individual file failures
      }
    }
  }
}

// Replaces a photo: copies the new one in, removes the old managed file.
export async function replacePhoto(
  sourceUri: string,
  babyId: string,
  previousUri: string | undefined
): Promise<string> {
  const newUri = await importPhoto(sourceUri, babyId);
  await deletePhotoIfInManagedDir(previousUri);
  return newUri;
}

export function collectBabyMediaUris(baby: Baby, milestones: MilestoneRecord[]): Set<string> {
  const uris = new Set<string>();
  if (baby.photoUri) uris.add(baby.photoUri);
  for (const m of milestones) {
    if (m.photoUri) uris.add(m.photoUri);
  }
  return uris;
}

// Erases the whole managed directory for one baby (used when a profile is deleted).
export async function deleteBabyMediaDir(babyId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const dir = babyDir(babyId);
    if (dir.exists) dir.delete();
  } catch {
    // already gone
  }
}
