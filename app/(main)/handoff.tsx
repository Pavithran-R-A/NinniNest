import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Copy, Share2 } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { formatDuration, formatMl } from '@/src/models/time';
import type { CareEvent } from '@/src/models/types';
import { PrimaryButton, SegmentedControl, EmptyState } from '@/src/components/ui';
import { useI18n } from '@/src/i18n/useI18n';
import { BRAND } from '@/src/i18n/brand';
import type { TFunc } from '@/src/i18n/strings';

function summarize(
  events: CareEvent[],
  hours: number,
  tr: TFunc,
  clock: (iso: string) => string
): string {
  const cutoff = Date.now() - hours * 3600000;
  const win = events.filter((e) => Date.parse(e.timestamp) >= cutoff);

  if (win.length === 0) {
    return `No care events recorded in the last ${hours} hours.`;
  }

  const lines: string[] = [];
  const feeds = win.filter((e) => e.type === 'feed_bottle' || e.type === 'feed_breast');
  const lastFeed = feeds[0];
  if (lastFeed) {
    if (lastFeed.type === 'feed_bottle') {
      lines.push(
        `Last feed: ${formatMl(lastFeed.amountMl)} ${
          lastFeed.milkType === 'breast_milk' ? 'breast milk' : lastFeed.milkType === 'formula' ? 'formula' : 'mixed'
        } at ${clock(lastFeed.timestamp)}`
      );
    } else {
      lines.push(
        `Last feed: breastfed ${formatDuration(lastFeed.durationMin)} (${lastFeed.side}) at ${clock(lastFeed.timestamp)}`
      );
    }
    lines.push(`Feeds in window: ${feeds.length}`);
  } else {
    lines.push('Last feed: not recorded in this window');
  }

  const diapers = win.filter((e) => e.type === 'diaper');
  const lastDiaper = diapers[0];
  if (lastDiaper && lastDiaper.type === 'diaper') {
    lines.push(
      `Last diaper: ${lastDiaper.diaperType} at ${clock(lastDiaper.timestamp)} (${diapers.length} in window)`
    );
  } else {
    lines.push('Last diaper: not recorded in this window');
  }

  const sleeps = win.filter((e) => e.type === 'sleep');
  const sleepTotal = sleeps.reduce((s, e) => s + (e.type === 'sleep' ? e.durationMin : 0), 0);
  if (sleeps.length > 0) {
    lines.push(`Sleep recorded: ${formatDuration(sleepTotal)} across ${sleeps.length} sleep${sleeps.length === 1 ? '' : 's'}`);
  } else {
    lines.push('Sleep: none recorded in this window');
  }

  const notes = win.filter((e) => e.type === 'note');
  for (const n of notes.slice(0, 3)) {
    lines.push(`Note (${clock(n.timestamp)}): ${n.type === 'note' ? n.note : ''}`);
  }

  return lines.join('\n');
}

export default function HandoffScreen() {
  const t = useTheme();
  const { currentBaby, data, isDemo } = useApp();
  const { t: tr, clock } = useI18n();
  const [hours, setHours] = useState<'12' | '24'>('12');
  const [copied, setCopied] = useState(false);

  const events = useMemo(() => {
    if (!currentBaby) return [];
    return data.events
      .filter((e) => e.babyId === currentBaby.id)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [data.events, currentBaby]);

  const letter = useMemo(() => {
    const header = tr('handoff.generated', {
      name: currentBaby?.name ?? '',
      hours,
      when: new Date().toLocaleString(),
    });
    return `${header}\n\n${summarize(events, Number(hours), tr, clock)}\n\n${BRAND.shareSignature}`;
  }, [events, hours, currentBaby, tr, clock]);

  const copy = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(letter);
      } else {
        // RN removed its built-in Clipboard; expo-clipboard is the SDK path.
        await Clipboard.setStringAsync(letter);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        await copy();
        return;
      }
      await Share.share({ message: letter });
    } catch {
      // user cancelled or share unavailable
    }
  };

  if (!currentBaby) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]}>
        <EmptyState title={tr('handoff.noBaby.title')} body={tr('handoff.noBaby.body')} />
      </SafeAreaView>
    );
  }

  const windowEvents = events.filter((e) => Date.parse(e.timestamp) >= Date.now() - Number(hours) * 3600000);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          {tr('handoff.title')}
        </Text>
        <Text style={[styles.subtitle, { color: t.inkMuted }]}>{tr('handoff.subtitle')}</Text>

        <View style={{ marginTop: spacing(3) }}>
          <SegmentedControl
            label="Handoff window"
            options={[
              { value: '12' as const, label: tr('handoff.window12') },
              { value: '24' as const, label: tr('handoff.window24') },
            ]}
            value={hours}
            onChange={setHours}
          />
        </View>

        <View style={[styles.letter, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.letterHead, { color: t.cinnamon }]}>
            {currentBaby.name} · {windowEvents.length} event{windowEvents.length === 1 ? '' : 's'}
            {isDemo ? ' · DEMO DATA' : ''}
          </Text>
          {windowEvents.length === 0 ? (
            <Text style={[styles.letterBody, { color: t.inkMuted }]}>{tr('handoff.empty')}</Text>
          ) : (
            windowEvents.slice(0, 30).map((e) => (
              <View key={e.id} style={styles.letterRow}>
                <Text style={[styles.letterTime, { color: t.inkMuted }]}>{clock(e.timestamp)}</Text>
                <Text style={[styles.letterBody, { color: t.ink }]}>{oneLine(e)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label={copied ? tr('handoff.copied') : tr('handoff.copy')}
            variant="secondary"
            onPress={copy}
            style={{ flex: 1 }}
          />
          <PrimaryButton label={tr('handoff.share')} onPress={share} style={{ flex: 1 }} />
        </View>
        <Text style={[styles.privacy, { color: t.inkFaint }]}>{tr('handoff.privacy')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function oneLine(e: CareEvent): string {
  switch (e.type) {
    case 'feed_bottle':
      return `Bottle — ${formatMl(e.amountMl)} (${e.milkType.replace('_', ' ')})`;
    case 'feed_breast':
      return `Breastfeed — ${formatDuration(e.durationMin)} (${e.side})`;
    case 'feed_solids':
      return `Solids — ${e.foodDescription}`;
    case 'diaper':
      return `Diaper — ${e.diaperType}`;
    case 'sleep':
      return `Sleep — ${formatDuration(e.durationMin)}`;
    case 'pump':
      return `Pump — ${formatMl(e.amountMl)} in ${formatDuration(e.durationMin)}`;
    case 'tummy_time':
      return `Tummy time — ${formatDuration(e.durationMin)}`;
    case 'note':
      return `Note — ${e.note}`;
  }
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
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing(1),
  },
  letter: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing(4),
    padding: spacing(4),
  },
  letterHead: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing(3),
  },
  letterRow: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(1.5),
  },
  letterTime: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    width: 56,
  },
  letterBody: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  privacy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing(3),
  },
});
