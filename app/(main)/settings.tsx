import React, { useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { PrimaryButton, Card, SegmentedControl } from '@/src/components/ui';
import { buildBackup, dryRunParse, mergeData, type ImportMode } from '@/src/models/backup';
import { backupFileName, pickBackupFile, shareCsvBundle, shareTextFile } from '@/src/models/share';
import { eventsToCsv, allCategoricalCsv } from '@/src/models/csv';
import { localKeyOf } from '@/src/models/calendar';

export default function SettingsScreen() {
  const t = useTheme();
  const {
    themeMode, setThemeMode, isDemo, enterDemo, exitDemo,
    resetPersonal, exportJson, importData, data, repo, refresh,
  } = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const personalCount = data.events.filter((e) => !e.isDemo).length;

  const doExport = async () => {
    const json = await exportJson();
    const result = await shareTextFile(backupFileName(new Date().toISOString()), json, 'application/json');
    setMessage(result.ok ? 'Backup saved or shared.' : result.message);
  };

  const doCsvExport = async () => {
    const files = [
      { name: 'care-history', content: eventsToCsv(data.events) },
      ...allCategoricalCsv(data),
    ];
    const result = await shareCsvBundle(files);
    setMessage(result.ok ? `CSV export ready (${files.length} files).` : result.message);
  };

  // Full import flow: dry-run validate, then merge or replace, transactionally.
  const runImport = async (json: string) => {
    const parsed = dryRunParse(json);
    if (!parsed.dryRun.ok) {
      const errors = parsed.dryRun.issues.filter((i) => i.severity === 'error');
      Alert.alert(
        'This backup cannot be imported',
        errors.map((e) => e.message).join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }
    const c = parsed.dryRun.counts;
    const summary = `${c.babies} profiles, ${c.events} events, ${c.growth} growth records, ${c.vaccinations} vaccinations, ${c.routines} routines.`;
    const warnings = parsed.dryRun.issues.filter((i) => i.severity === 'warning');
    Alert.alert(
      'Review this import',
      `${summary}${warnings.length ? '\n\n' + warnings.map((w) => w.message).join('\n') : ''}\n\nMode: ${importMode === 'merge' ? 'Merge — keep everything, add new records only' : 'Replace — erase current records first'}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              // Transactional: build target, validate, then single replaceAll write.
              const target =
                importMode === 'replace'
                  ? { ...parsed.backup.data, schemaVersion: 3 as const }
                  : mergeData(data, parsed.backup.data);
              if (target.babies.length === 0) {
                setMessage('Nothing to import — no valid profiles in the file.');
                return;
              }
              await repo.replaceAll(target);
              await refresh();
              setMessage(importMode === 'replace' ? 'Backup restored (replace).' : 'Backup merged into your journal.');
            } catch {
              setMessage('Import failed before anything was written. Your existing records are untouched.');
            }
          },
        },
      ]
    );
  };

  const pickImport = async () => {
    const picked = await pickBackupFile();
    if (!picked.ok || !picked.json) {
      if (picked.message) setMessage(picked.message);
      return;
    }
    await runImport(picked.json);
  };

  const confirmErase = () => {
    Alert.alert(
      'Erase all data?',
      'This permanently deletes every baby profile and care record on this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: async () => {
            await resetPersonal();
            setMessage('All data erased.');
          },
        },
      ]
    );
  };

  const confirmDemo = () => {
    if (isDemo) {
      exitDemo();
      setMessage('Demo ended. Your journal is empty and ready for real records.');
      return;
    }
    Alert.alert(
      'Try demo mode?',
      'Demo mode fills the app with clearly-labelled synthetic records. It never mixes with real data, and exiting removes it completely.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start demo', onPress: async () => { await enterDemo(); setMessage('Demo mode is on. Records are marked as demo.'); } },
      ]
    );
  };

  const webInput = Platform.OS === 'web' && typeof document !== 'undefined' && (
    <input
      ref={fileRef as unknown as React.RefObject<HTMLInputElement>}
      type="file"
      accept="application/json"
      style={{ display: 'none' }}
      onChange={(e) => {
        void pickImport();
        e.target.value = '';
      }}
    />
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
      {webInput}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          Settings
        </Text>

        {message && (
          <Card style={{ marginTop: spacing(3) }}>
            <Text style={[styles.message, { color: t.ink }]}>{message}</Text>
          </Card>
        )}

        <Section title="Appearance">
          <Card>
            <Row
              label="Night mode"
              detail="Warm, dim, and fully legible for 3 AM feeds."
            >
              <Switch
                value={themeMode === 'night'}
                onValueChange={(v) => setThemeMode(v ? 'night' : 'day')}
                trackColor={{ true: t.accent, false: t.hairline }}
                thumbColor={themeMode === 'night' ? t.accentInk : '#FFFFFF'}
                accessibilityLabel="Night mode"
              />
            </Row>
          </Card>
        </Section>

        <Section title="Your data">
          <Card>
            <Text style={[styles.dataLine, { color: t.inkMuted }]}>
              {personalCount} care event{personalCount === 1 ? '' : 's'} stored on this device.
              Nothing is synced or uploaded anywhere.
            </Text>
            <View style={styles.btnCol}>
              <PrimaryButton label="Export backup (JSON)" variant="secondary" onPress={doExport} />
              <PrimaryButton label="Export care history (CSV)" variant="secondary" onPress={doCsvExport} />
              <PrimaryButton label="Import a backup" variant="secondary" onPress={pickImport} />
            </View>
            <View style={{ marginTop: spacing(3) }}>
              <Text style={[styles.importModeLabel, { color: t.ink }]}>When importing:</Text>
              <SegmentedControl
                label="Import mode"
                options={[
                  { value: 'merge' as const, label: 'Merge' },
                  { value: 'replace' as const, label: 'Replace all' },
                ]}
                value={importMode}
                onChange={setImportMode}
              />
              <Text style={[styles.importModeHint, { color: t.inkFaint }]}>
                Merge adds new records and keeps everything you have. Replace erases current
                records first. Either way the file is fully checked before anything changes.
              </Text>
            </View>
            <PrimaryButton
              label="Erase all data"
              onPress={confirmErase}
              style={{ backgroundColor: t.cinnamon, marginTop: spacing(3) }}
            />
          </Card>
        </Section>

        <Section title="Demo mode">
          <Card>
            <Text style={[styles.dataLine, { color: t.inkMuted }]}>
              Demo mode fills the app with clearly marked synthetic records so you can explore
              freely. It never touches real data.
            </Text>
            <PrimaryButton
              label={isDemo ? 'Exit demo mode' : 'Try demo mode'}
              variant="secondary"
              onPress={confirmDemo}
            />
          </Card>
        </Section>

        <Section title="About">
          <Card>
            <Text style={[styles.about, { color: t.inkMuted }]}>
              NinniNest is a local-first care journal. Core tracking, history, export and erase
              are free forever. There is no account, no advertising and no hidden subscription.
            </Text>
            <Text style={[styles.aboutVersion, { color: t.inkFaint }]}>Version 0.4.0 · Phase D</Text>
          </Card>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: spacing(4) }}>
      <Text style={[styles.sectionTitle, { color: t.cinnamon }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Row({
  label, detail, children,
}: {
  label: string;
  detail: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: t.ink }]}>{label}</Text>
        <Text style={[styles.rowDetail, { color: t.inkMuted }]}>{detail}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: spacing(4),
    paddingBottom: spacing(10),
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { flex: 1, paddingRight: spacing(3) },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  dataLine: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing(3),
  },
  btnCol: { gap: spacing(2) },
  importModeLabel: { fontSize: 14, fontWeight: '600', marginBottom: spacing(1.5) },
  importModeHint: { fontSize: 12, lineHeight: 18, marginTop: spacing(1.5) },
  message: {
    fontSize: 14,
    lineHeight: 21,
  },
  about: {
    fontSize: 14,
    lineHeight: 21,
  },
  aboutVersion: {
    fontSize: 12,
    marginTop: spacing(2),
  },
});
