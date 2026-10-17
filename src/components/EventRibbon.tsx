import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Milk as BottleIcon,
  Moon,
  Shirt,
  Timer,
  NotebookPen,
} from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { formatClock, formatDuration, formatMl } from '@/src/models/time';
import type { CareEvent } from '@/src/models/types';
import { spacing } from '@/src/design/tokens';

const ICONS: Record<CareEvent['type'], React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  feed_bottle: BottleIcon,
  feed_breast: Timer,
  feed_solids: BottleIcon,
  diaper: Shirt,
  sleep: Moon,
  pump: BottleIcon,
  tummy_time: Timer,
  note: NotebookPen,
};

const FALLBACK: Record<CareEvent['type'], string> = {
  feed_bottle: 'Bottle',
  feed_breast: 'Breastfeed',
  feed_solids: 'Solids',
  diaper: 'Diaper',
  sleep: 'Sleep',
  pump: 'Pump',
  tummy_time: 'Tummy time',
  note: 'Note',
};

export function describeEvent(e: CareEvent): string {
  switch (e.type) {
    case 'feed_bottle':
      return `${formatMl(e.amountMl)} (${e.milkType === 'breast_milk' ? 'breast milk' : e.milkType === 'formula' ? 'formula' : 'mixed'})`;
    case 'feed_breast':
      return `${formatDuration(e.durationMin)} · ${e.side}`;
    case 'feed_solids':
      return e.foodDescription;
    case 'diaper':
      return e.diaperType === 'both' ? 'wet + dirty' : e.diaperType;
    case 'sleep':
      return formatDuration(e.durationMin);
    case 'pump':
      return `${formatMl(e.amountMl)} in ${formatDuration(e.durationMin)}`;
    case 'tummy_time':
      return formatDuration(e.durationMin);
    case 'note':
      return e.note;
  }
}

export function EventRibbonItem({
  event, onPress,
}: {
  event: CareEvent;
  onPress?: () => void;
}) {
  const t = useTheme();
  const Icon = ICONS[event.type];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${FALLBACK[event.type]}: ${describeEvent(event)}, at ${formatClock(event.timestamp)}`}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.spine}>
        <View style={[styles.dot, { backgroundColor: t.accent }]} />
        <View style={[styles.line, { backgroundColor: t.hairline }]} />
      </View>
      <View style={[styles.iconWrap, { backgroundColor: t.accentSoft }]}>
        <Icon size={16} color={t.accent} strokeWidth={2} />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: t.ink }]}>{FALLBACK[event.type]}</Text>
          <Text style={[styles.time, { color: t.inkMuted }]}>{formatClock(event.timestamp)}</Text>
        </View>
        <Text style={[styles.detail, { color: t.inkMuted }]} numberOfLines={2}>
          {describeEvent(event)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  spine: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 22,
  },
  line: {
    flex: 1,
    width: 1,
    marginTop: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginRight: spacing(2),
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: spacing(2),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  time: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
});
