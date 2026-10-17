import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy, Share2 } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { formatClock, formatDuration, formatMl, localDateKey } from '@/src/models/time';
import type { CareEvent } from '@/src/models/types';
import { PrimaryButton, SegmentedControl, EmptyState } from '@/src/components/ui';

function summarize(events: CareEvent[], hours: number): string {
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
        } at ${formatClock(lastFeed.timestamp)}`
      );
    } else {
      lines.push(
        `Last feed: breastfed ${formatDuration(lastFeed.durationMin)} (${lastFeed.side}) at ${formatClock(lastFeed.timestamp)}`
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
      `Last diaper: ${lastDiaper.diaperType} at ${formatClock(lastDiaper.timestamp)} (${diapers.length} in window)`
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
    lines.push(`Note (${formatClock(n.timestamp)}): ${n.type === 'note' ? n.note : ''}`);
  }

  return lines.join('\n');
}

export default function HandoffScreen() {
  const t = useTheme();
  const { currentBaby, data, isDemo } = useApp();
  const [hours, setHours] = useState<'12' | '24'>('12');
  const [copied, setCopied] = useState(false);

  const events = useMemo(() => {
    if (!currentBaby) return [];
    return data.events
      .filter((e) => e.babyId === currentBaby.id)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [data.events, currentBaby]);

  const letter = useMemo(() => {
    const header = `Care handoff — ${currentBaby?.name ?? ''} (${hours}h window, generated ${new Date().toLocaleString()})`;
    return `${header}\n\n${summarize(events, Number(hours))}\n\nRecorded with NinniNest.`;
  }, [events, hours, currentBaby]);

  const copy = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(letter);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Clipboard } = require('react-native');
        await Clipboard.setString(letter);
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
        <EmptyState title="No baby profile" body="Create a profile first to build a handoff." />
      </SafeAreaView>
    );
  }

  const windowEvents = events.filter((e) => Date.parse(e.timestamp) >= Date.now() - Number(hours) * 3600000);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          Care handoff
        </Text>
        <Text style={[styles.subtitle, { color: t.inkMuted }]}>
          A precise letter for the next caregiver — built only from what was actually recorded.
        </Text>

        <View style={{ marginTop: spacing(3) }}>
          <SegmentedControl
            label="Handoff window"
            options={[
              { value: '12' as const, label: 'Last 12 hours' },
              { value: '24' as const, label: 'Last 24 hours' },
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
            <Text style={[styles.letterBody, { color: t.inkMuted }]}>
              Nothing recorded in this window. Entries appear here the moment they are logged.
            </Text>
          ) : (
            windowEvents.slice(0, 30).map((e) => (
              <View key={e.id} style={styles.letterRow}>
                <Text style={[styles.letterTime, { color: t.inkMuted }]}>{formatClock(e.timestamp)}</Text>
                <Text style={[styles.letterBody, { color: t.ink }]}>{oneLine(e)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label={copied ? 'Copied' : 'Copy letter'}
            variant="secondary"
            onPress={copy}
            style={{ flex: 1 }}
          />
          <PrimaryButton label="Share…" onPress={share} style={{ flex: 1 }} />
        </View>
        <Text style={[styles.privacy, { color: t.inkFaint }]}>
          This letter contains private care information. Share only with trusted caregivers.
        </Text>
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
