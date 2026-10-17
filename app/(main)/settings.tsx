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
import { PrimaryButton, Card } from '@/src/components/ui';

export default function SettingsScreen() {
  const t = useTheme();
  const {
    themeMode, setThemeMode, isDemo, enterDemo, exitDemo,
    resetPersonal, exportJson, importData, data,
  } = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const personalCount = data.events.filter((e) => !e.isDemo).length;

  const doExport = async () => {
    const json = await exportJson();
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ninninest-backup-${localToday()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage('Backup downloaded.');
      } else {
        const { Share } = require('react-native');
        await Share.share({ message: json.slice(0, 2000) });
        setMessage('Use the share sheet to save or send your backup. For very long histories, export from a device that supports file sharing.');
      }
    } catch {
      setMessage('Export did not complete.');
    }
  };

  const pickImport = () => {
    if (Platform.OS === 'web') {
      fileRef.current?.click();
    } else {
      setMessage('On phones, import will arrive with the next release. You can already export.');
    }
  };

  const handleWebImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await importData(text);
    setMessage(result.message);
    input.value = '';
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
      onChange={handleWebImport}
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
              <PrimaryButton label="Import a backup" variant="secondary" onPress={pickImport} />
              <PrimaryButton label="Erase all data" onPress={confirmErase} style={{ backgroundColor: t.cinnamon }} />
            </View>
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
            <Text style={[styles.aboutVersion, { color: t.inkFaint }]}>Version 0.1.0 · vertical slice</Text>
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

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
