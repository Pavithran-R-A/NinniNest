import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { localDateKey } from '@/src/models/time';
import { EventRibbonItem } from '@/src/components/EventRibbon';
import { EmptyState } from '@/src/components/ui';
import { EventActionsModal } from '@/src/screens/EventActions';

export default function JournalScreen() {
  const t = useTheme();
  const { currentBaby, data, isDemo } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  const sections = useMemo(() => {
    if (!currentBaby) return [];
    const byDay = new Map<string, typeof data.events>();
    for (const e of data.events.filter((ev) => ev.babyId === currentBaby.id)) {
      const key = localDateKey(new Date(e.timestamp));
      const arr = byDay.get(key) ?? [];
      arr.push(e);
      byDay.set(key, arr);
    }
    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, evts]) => ({
        key: day,
        title: new Date(day + 'T12:00:00').toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        data: evts.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
      }));
  }, [data.events, currentBaby]);

  const selectedEvent = data.events.find((e) => e.id === selected) ?? null;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          Journal
        </Text>
        <Text style={[styles.subtitle, { color: t.inkMuted }]}>
          {currentBaby ? `${currentBaby.name} · full history` : ''}
        </Text>
      </View>
      {sections.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          body="Your journal fills in as you log care events on the Today screen."
        />
      ) : (
        <SectionList
          contentContainerStyle={styles.list}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.dayHeader, { color: t.cinnamon }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <EventRibbonItem event={item} onPress={() => setSelected(item.id)} />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}
      <EventActionsModal
        event={selectedEvent}
        onClose={() => setSelected(null)}
      />
      {isDemo ? (
        <Text style={[styles.demoTag, { color: t.inkMuted }]}>Demo data — not your records</Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    marginTop: spacing(1),
  },
  list: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(10),
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing(4),
    marginBottom: spacing(1),
  },
  demoTag: {
    position: 'absolute',
    bottom: spacing(2),
    alignSelf: 'center',
    fontSize: 12,
  },
});
