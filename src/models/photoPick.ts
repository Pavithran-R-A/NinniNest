import * as ImagePicker from 'expo-image-picker';

export interface PickPhotoResult {
  ok: boolean;
  uri?: string;
  /** Machine-readable failure so the UI can show a localized message. */
  error?: 'permission' | 'canceled' | 'unreadable' | 'open-failed';
}

// Opens the media library and returns a picker URI. The caller must copy the
// result into managed storage (src/models/media.ts) before persisting it.
export async function pickPhoto(): Promise<PickPhotoResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, error: 'permission' };
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) {
      return { ok: false, error: 'canceled' };
    }
    const uri = result.assets[0]?.uri;
    if (!uri) return { ok: false, error: 'unreadable' };
    return { ok: true, uri };
  } catch {
    return { ok: false, error: 'open-failed' };
  }
}
