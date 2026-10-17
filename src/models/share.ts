import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Directory, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import type { BackupFile } from './backup';

// Writes content to a file in the app's cache and opens the platform share sheet.
// Web falls back to a browser download via a blob anchor click.
export async function shareTextFile(
  fileName: string,
  content: string,
  mimeType: string
): Promise<{ ok: boolean; message: string }> {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { ok: true, message: `Downloaded ${fileName}` };
    } catch {
      return { ok: false, message: 'The browser blocked the download.' };
    }
  }
  try {
    const file = new File(Paths.cache, fileName);
    file.create();
    await file.write(content);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
      return { ok: true, message: 'Shared' };
    }
    return { ok: false, message: 'Sharing is not available on this device.' };
  } catch {
    return { ok: false, message: 'Could not prepare the file for sharing.' };
  }
}

export async function shareCsvBundle(
  files: { name: string; content: string }[]
): Promise<{ ok: boolean; message: string }> {
  if (files.length === 1) {
    return shareTextFile(`${files[0].name}.csv`, files[0].content, 'text/csv');
  }
  if (Platform.OS === 'web') {
    // Sequential downloads, one per file.
    for (const f of files) {
      const r = await shareTextFile(`${f.name}.csv`, f.content, 'text/csv');
      if (!r.ok) return r;
    }
    return { ok: true, message: `Downloaded ${files.length} CSV files` };
  }
  try {
    const dir = new Directory(Paths.cache, `ninninest-csv-${Date.now()}`);
    dir.create({ idempotent: true });
    for (const f of files) {
      const file = new File(dir, `${f.name}.csv`);
      await file.write(f.content);
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dir.uri, { dialogTitle: 'NinniNest CSV export' });
      return { ok: true, message: 'Shared' };
    }
    return { ok: false, message: 'Sharing is not available on this device.' };
  } catch {
    return { ok: false, message: 'Could not prepare the CSV bundle.' };
  }
}

// Opens the native document picker (or the web file input) and returns the text
// content of the chosen backup file.
export async function pickBackupFile(): Promise<{ ok: boolean; json?: string; message: string }> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve({ ok: false, message: 'No file chosen.' });
        const reader = new FileReader();
        reader.onload = () => resolve({ ok: true, json: String(reader.result), message: '' });
        reader.onerror = () => resolve({ ok: false, message: 'The file could not be read.' });
        reader.readAsText(file);
      };
      input.oncancel = () => resolve({ ok: false, message: 'No file chosen.' });
      input.click();
    });
  }
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) {
      return { ok: false, message: 'No file chosen.' };
    }
    const asset = result.assets[0];
    const file = new File(asset.uri);
    return { ok: true, json: await file.text(), message: '' };
  } catch {
    return { ok: false, message: 'The file could not be read.' };
  }
}

export function backupFileName(exportedAt: string): string {
  return `ninninest-backup-${exportedAt.slice(0, 10)}.json`;
}

export type { BackupFile };
