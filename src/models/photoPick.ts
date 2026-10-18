import * as ImagePicker from 'expo-image-picker';

export interface PickPhotoResult {
  ok: boolean;
  uri?: string;
  message?: string;
}

// Opens the media library and returns a picker URI. The caller must copy the
// result into managed storage (src/models/media.ts) before persisting it.
export async function pickPhoto(): Promise<PickPhotoResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, message: 'Photo access needs your permission to add pictures.' };
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) {
      return { ok: false, message: 'No photo chosen.' };
    }
    const uri = result.assets[0]?.uri;
    if (!uri) return { ok: false, message: 'The photo could not be read.' };
    return { ok: true, uri };
  } catch {
    return { ok: false, message: 'The photo could not be opened.' };
  }
}
