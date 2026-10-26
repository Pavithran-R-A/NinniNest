import React, { useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { PrimaryButton, Card, SegmentedControl } from '@/src/components/ui';
import { useI18n } from '@/src/i18n/useI18n';
import { LOCALES, type Locale } from '@/src/i18n/strings';
import { type ImportMode } from '@/src/models/backup';
import { planImport, describeImportPlan } from '@/src/models/importPlan';
import { runStagedBackupImport } from '@/src/models/backupRestore';
import { buildFullBackupWithReport, createMediaPort } from '@/src/models/mediaBackup';
import { backupFileName, pickBackupFile, shareCsvBundle, shareTextFile } from '@/src/models/share';
import { eventsToCsv, allCategoricalCsv } from '@/src/models/csv';

export default function SettingsScreen() {
  const t = useTheme();
  const {
    themeMode, setThemeMode, isDemo, enterDemo, exitDemo,
    resetPersonal, exportJson, importData, data, repo, refresh,
    locale, setLocale, clockFormat, setClockFormat,
  } = useApp();
  const { t: tr } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const personalCount = data.events.filter((e) => !e.isDemo).length;

  const doExport = async () => {
    // Full backup: records + settings + embedded photo bytes. Photos that
    // cannot be read are reported, never silently omitted — the message says
    // plainly when a backup is incomplete.
    const { backup, missingPhotos } = await buildFullBackupWithReport(data, { themeMode });
    const json = JSON.stringify(backup);
    const result = await shareTextFile(backupFileName(new Date().toISOString()), json, 'application/json');
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const photoCount = backup.photosEmbedded.length;
    setMessage(
      missingPhotos.length > 0
        ? tr('settings.exportIncomplete', { n: missingPhotos.length })
        : photoCount > 0
          ? tr('settings.exportComplete', { n: photoCount })
          : tr('settings.exportCompleteNoPhotos')
    );
  };
  const doCsvExport = async () => {
    const files = [
      { name: 'care-history', content: eventsToCsv(data.events) },
      ...allCategoricalCsv(data),
    ];
    const result = await shareCsvBundle(files);
    setMessage(result.ok ? `CSV export ready (${files.length} files).` : result.message);
  };

  // Import flow: strict planImport validation, explicit confirmation, then the
  // staged restore — photos are verified, quarantined and promoted BEFORE the
  // single transactional database write; a failure anywhere rolls back to the
  // previous records and media with nothing partial left behind.
  const runImport = async (json: string) => {
    const plan = planImport(json, data, importMode);
    if (!plan.ok) {
      const errors = plan.issues.filter((i) => i.severity === 'error');
      Alert.alert(
        'This backup cannot be imported',
        errors.map((e) => e.message).join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }
    const summary = describeImportPlan(plan);
    const warnings = plan.issues.filter((i) => i.severity === 'warning');
    Alert.alert(
      'Review this import',
      `${summary}.${warnings.length ? '\n\n' + warnings.map((w) => w.message).join('\n') : ''}\n\nMode: ${importMode === 'merge' ? 'Merge — keep everything, add new records only' : 'Replace — erase current records first'}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              const result = await runStagedBackupImport(repo, plan, {
                media: createMediaPort(),
                refresh,
                current: data,
              });
              const modeLabel = tr(importMode === 'merge' ? 'settings.importModeMerge' : 'settings.importModeReplace');
              if (result.outcome === 'complete') {
                setMessage(tr('settings.importComplete', { mode: modeLabel, summary, n: result.restoredPhotos }));
              } else if (result.outcome === 'incomplete-photos') {
                setMessage(tr('settings.importIncomplete', { mode: modeLabel, summary, n: result.failedPhotos }));
              } else if (result.outcome === 'records-only') {
                setMessage(tr('settings.importRecordsOnly', { mode: modeLabel, summary }));
              } else if (result.outcome === 'storage-failed') {
                setMessage(tr('settings.importStorageFailed'));
              } else if (result.outcome === 'rolled-back') {
                setMessage(tr('settings.importRolledBack'));
              } else {
                setMessage(tr('settings.importValidationFailed'));
              }
            } catch {
              setMessage(tr('settings.importStorageFailed'));
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
      void exitDemo().then(() => {
        setMessage('Demo ended. Your own records are back, exactly as you left them.');
      });
      return;
    }
    Alert.alert(
      'Try demo mode?',
      'Demo mode fills the app with clearly-labelled synthetic records in a separate storage space. Your real data stays untouched, and exiting brings it back.',
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
          {tr('settings.title')}
        </Text>

        {message && (
          <Card style={{ marginTop: spacing(3) }}>
            <Text style={[styles.message, { color: t.ink }]}>{message}</Text>
          </Card>
        )}

        <Section title={tr('settings.section.appearance')}>
          <Card>
            <Text style={[styles.rowLabel, { color: t.ink }]}>{tr('settings.nightMode')}</Text>
            <Text style={[styles.rowDetail, { color: t.inkMuted, marginBottom: spacing(2) }]}>
              {tr('settings.nightModeDetail')}
            </Text>
            <View style={styles.btnCol}>
              <PrimaryButton
                label="Day"
                variant={themeMode === 'day' ? 'primary' : 'secondary'}
                onPress={() => setThemeMode('day')}
                accessibilityLabel="Theme: day"
              />
              <PrimaryButton
                label="Night"
                variant={themeMode === 'night' ? 'primary' : 'secondary'}
                onPress={() => setThemeMode('night')}
                accessibilityLabel="Theme: night"
              />
              <PrimaryButton
                label="Night · warm"
                variant={themeMode === 'nightWarm' ? 'primary' : 'secondary'}
                onPress={() => setThemeMode('nightWarm')}
                accessibilityLabel="Theme: warm night"
              />
            </View>
          </Card>
        </Section>

        <Section title={tr('settings.section.language')}>
          <Card>
            <Text style={[styles.rowLabel, { color: t.ink }]}>{tr('settings.language')}</Text>
            <Text style={[styles.rowDetail, { color: t.inkMuted, marginBottom: spacing(2) }]}>
              {tr('settings.languageDetail')}
            </Text>
            <View style={styles.btnCol}>
              {LOCALES.map((l) => (
                <PrimaryButton
                  key={l.code}
                  label={l.nativeLabel}
                  variant={locale === l.code ? 'primary' : 'secondary'}
                  onPress={() => setLocale(l.code as Locale)}
                  accessibilityLabel={`${tr('settings.language')}: ${l.nativeLabel}`}
                />
              ))}
            </View>
            <View style={{ marginTop: spacing(3) }}>
              <Text style={[styles.rowLabel, { color: t.ink, marginBottom: spacing(1.5) }]}>
                {tr('settings.clock')}
              </Text>
              <SegmentedControl
                label={tr('settings.clock')}
                options={[
                  { value: '12h' as const, label: tr('settings.clock12') },
                  { value: '24h' as const, label: tr('settings.clock24') },
                ]}
                value={clockFormat}
                onChange={setClockFormat}
              />
            </View>
          </Card>
        </Section>

        <Section title={tr('settings.section.data')}>
          <Card>
            <Text style={[styles.dataLine, { color: t.inkMuted }]}>
              {personalCount} care event{personalCount === 1 ? '' : 's'} stored on this device.
              Nothing is synced or uploaded anywhere.
            </Text>
            <View style={styles.btnCol}>
              <PrimaryButton label={tr('settings.exportJson')} variant="secondary" onPress={doExport} />
              <PrimaryButton label={tr('settings.exportCsv')} variant="secondary" onPress={doCsvExport} />
              <PrimaryButton label={tr('settings.import')} variant="secondary" onPress={pickImport} />
            </View>
            <View style={{ marginTop: spacing(3) }}>
              <Text style={[styles.importModeLabel, { color: t.ink }]}>{tr('settings.importMode')}</Text>
              <SegmentedControl
                label="Import mode"
                options={[
                  { value: 'merge' as const, label: tr('settings.importModeMerge') },
                  { value: 'replace' as const, label: tr('settings.importModeReplace') },
                ]}
                value={importMode}
                onChange={setImportMode}
              />
              <Text style={[styles.importModeHint, { color: t.inkFaint }]}>
                {tr('settings.importModeHint')}
              </Text>
            </View>
            <PrimaryButton
              label={tr('settings.erase')}
              onPress={confirmErase}
              style={{ backgroundColor: t.cinnamon, marginTop: spacing(3) }}
            />
          </Card>
        </Section>

        <Section title={tr('settings.section.demo')}>
          <Card>
            <Text style={[styles.dataLine, { color: t.inkMuted }]}>
              Demo mode fills the app with clearly marked synthetic records so you can explore
              freely. It never touches real data.
            </Text>
            <PrimaryButton
              label={isDemo ? tr('settings.exitDemo') : tr('settings.tryDemo')}
              variant="secondary"
              onPress={confirmDemo}
            />
          </Card>
        </Section>

        <Section title={tr('settings.section.about')}>
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
