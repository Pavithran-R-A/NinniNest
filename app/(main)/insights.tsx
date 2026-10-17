import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Baby as BabyIcon } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { EmptyState, SegmentedControl } from '@/src/components/ui';
import {
  summarizeFeeds, summarizeSleep, summarizeDiapers, summarizePumping,
  summarizeTummyTime, activityByDay, lastNDays, growthHistory,
  medicationHistory, milestoneTimeline, type DayWindow,
} from '@/src/models/analytics';
import { formatDuration } from '@/src/models/time';
import { formatWeight, formatLength, ageInDays } from '@/src/models/growth';
import type { CareEvent } from '@/src/models/types';

type Range = '7d' | '30d' | 'day';

function SectionHeading({ title, kicker }: { title: string; kicker?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: spacing(5), marginBottom: spacing(2) }}>
      {kicker ? (
        <Text style={[styles.kicker, { color: t.cinnamon }]}>{kicker}</Text>
      ) : null}
      <Text style={[styles.sectionTitle, { color: t.ink, fontFamily: fontNames.display }]}>{title}</Text>
    </View>
  );
}

function Metric({ value, label, emphasis }: { value: string; label: string; emphasis?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.metric}>
      <Text
        style={[
          styles.metricValue,
          { color: t.ink, fontFamily: fontNames.display },
          emphasis && { fontSize: 34 },
        ]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[styles.metricLabel, { color: t.inkMuted }]}>{label}</Text>
    </View>
  );
}

function Figure({ left, right, note }: { left: string; right: string; note?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.figureRow, { borderBottomColor: t.hairline }]}>
      <Text style={[styles.figureLeft, { color: t.ink }]}>{left}</Text>
      <Text style={[styles.figureRight, { color: t.accent }]}>{right}</Text>
      {note ? <Text style={[styles.figureNote, { color: t.inkFaint }]}>{note}</Text> : null}
    </View>
  );
}

function DayBars({
  days, max, color, track,
}: {
  days: { date: string; minutes: number }[];
  max: number;
  color: string;
  track: string;
}) {
  return (
    <View style={styles.barsWrap}>
      {days.map((d) => {
        const h = max > 0 ? Math.max(2, Math.round((d.minutes / max) * 64)) : 2;
        return (
          <View key={d.date} style={styles.barCol}>
            <View style={[styles.bar, { height: h, backgroundColor: d.minutes > 0 ? color : track }]} />
            <Text style={[styles.barLabel, { color: track === 'transparent' ? '#999' : undefined }]}>
              {d.date.slice(8)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function InsightsScreen() {
  const t = useTheme();
  const { data, currentBaby, isDemo } = useApp();
  const [range, setRange] = useState<Range>('7d');
  const [babyId, setBabyId] = useState<string | null>(null);

  const babies = useMemo(() => data.babies.filter((b) => !b.isDemo || isDemo), [data.babies, isDemo]);
  const selectedBabyId = babyId ?? currentBaby?.id ?? babies[0]?.id ?? null;

  const window: DayWindow = useMemo(() => {
    if (range === 'day') return lastNDays(1);
    if (range === '30d') return lastNDays(30);
    return lastNDays(7);
  }, [range]);

  const events: CareEvent[] = useMemo(() => {
    if (!selectedBabyId) return [];
    const all = data.events.filter((e) => e.babyId === selectedBabyId);
    return isDemo ? all : all.filter((e) => !e.isDemo);
  }, [data.events, selectedBabyId, isDemo]);

  const feeds = useMemo(() => summarizeFeeds(events, window, selectedBabyId ?? undefined), [events, window, selectedBabyId]);
  const pump = useMemo(() => summarizePumping(events, window, selectedBabyId ?? undefined), [events, window, selectedBabyId]);
  const sleep = useMemo(() => summarizeSleep(events, window, selectedBabyId ?? undefined), [events, window, selectedBabyId]);
  const diapers = useMemo(() => summarizeDiapers(events, window, selectedBabyId ?? undefined), [events, window, selectedBabyId]);
  const tummy = useMemo(() => summarizeTummyTime(events, window, selectedBabyId ?? undefined), [events, window, selectedBabyId]);
  const activity = useMemo(() => activityByDay(events, window, selectedBabyId ?? undefined), [events, window, selectedBabyId]);

  const growth = useMemo(
    () => (selectedBabyId ? growthHistory(data.growthRecords, selectedBabyId) : []),
    [data.growthRecords, selectedBabyId]
  );
  const medRecords = useMemo(
    () => (selectedBabyId ? medicationHistory(data.medicationAdministrations, selectedBabyId, window) : []),
    [data.medicationAdministrations, selectedBabyId, window]
  );
  const milestones = useMemo(
    () => (selectedBabyId ? milestoneTimeline(data.milestones, selectedBabyId) : []),
    [data.milestones, selectedBabyId]
  );

  const maxSleep = Math.max(...sleep.byDay.map((d) => d.minutes), 1);
  const hasAny = events.length > 0;

  if (!selectedBabyId) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>Insights</Text>
        </View>
        <EmptyState
          title="Nothing to show yet"
          body="Create a baby profile and log a few moments — your patterns will appear here."
        />
      </SafeAreaView>
    );
  }

  const selectedBaby = babies.find((b) => b.id === selectedBabyId);
  const windowLabel =
    range === 'day'
      ? 'Today'
      : range === '7d'
        ? 'Last 7 days'
        : 'Last 30 days';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: t.cinnamon }]}>
            {selectedBaby ? `${selectedBaby.name} · ${ageInDays(selectedBaby.birthDate, new Date().toISOString().slice(0, 10))} days old` : ''}
          </Text>
          <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>Insights</Text>
        </View>

        <View style={{ marginTop: spacing(3), gap: spacing(2) }}>
          <SegmentedControl
            label="Date range"
            options={[
              { value: 'day' as const, label: 'Today' },
              { value: '7d' as const, label: '7 days' },
              { value: '30d' as const, label: '30 days' },
            ]}
            value={range}
            onChange={setRange}
          />
          {babies.length > 1 ? (
            <View style={styles.babyRow}>
              {babies.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => setBabyId(b.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: b.id === selectedBabyId }}
                  style={[
                    styles.babyChip,
                    { backgroundColor: b.id === selectedBabyId ? t.accent : t.surfaceAlt, borderColor: t.hairline },
                  ]}
                >
                  <Text style={{ color: b.id === selectedBabyId ? t.accentInk : t.ink, fontSize: 13, fontWeight: '600' }}>
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {!hasAny ? (
          <EmptyState
            title={`No records in ${windowLabel.toLowerCase()}`}
            body="Everything you log on the Today screen appears here as gentle summaries. Nothing is invented to fill the space."
          />
        ) : (
          <>
            <SectionHeading kicker={windowLabel} title="Feeding" />
            <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <View style={styles.metricRow}>
                <Metric value={String(feeds.breastSessionCount)} label="nursing sessions" />
                <Metric value={formatDuration(feeds.breastTotalMin)} label="at breast" />
                <Metric value={`${Math.round(feeds.bottleTotalMl)}`} label="mL by bottle" />
              </View>
              <View style={{ marginTop: spacing(3) }}>
                <Figure left="Left side" right={formatDuration(feeds.breastMinBySide.left)} />
                <Figure left="Right side" right={formatDuration(feeds.breastMinBySide.right)} />
                <Figure left="Both sides" right={formatDuration(feeds.breastMinBySide.both)} />
                {feeds.bottleCount > 0 ? (
                  <>
                    <Figure left="Breast milk (bottle)" right={`${Math.round(feeds.bottleMlByMilkType.breast_milk)} mL`} />
                    <Figure left="Formula (bottle)" right={`${Math.round(feeds.bottleMlByMilkType.formula)} mL`} />
                    {feeds.bottleMlByMilkType.mixed > 0 ? (
                      <Figure left="Mixed milk (bottle)" right={`${Math.round(feeds.bottleMlByMilkType.mixed)} mL`} />
                    ) : null}
                  </>
                ) : null}
                {feeds.solidsCount > 0 ? <Figure left="Solid-food meals" right={String(feeds.solidsCount)} /> : null}
              </View>
            </View>

            {pump.sessionCount > 0 ? (
              <>
                <SectionHeading kicker={windowLabel} title="Pumping" />
                <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                  <View style={styles.metricRow}>
                    <Metric value={String(pump.sessionCount)} label="sessions" />
                    <Metric value={`${Math.round(pump.totalMl)} mL`} label="collected" />
                    <Metric value={formatDuration(pump.totalMin)} label="time pumping" />
                  </View>
                </View>
              </>
            ) : null}

            <SectionHeading kicker={windowLabel} title="Sleep" />
            <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <View style={styles.metricRow}>
                <Metric value={formatDuration(sleep.totalMin)} label="total" emphasis />
                <Metric value={formatDuration(sleep.nightMin)} label="night" />
                <Metric value={formatDuration(sleep.napMin)} label="naps" />
              </View>
              <View style={{ marginTop: spacing(4) }}>
                <DayBars days={sleep.byDay} max={maxSleep} color={t.accent} track={t.surfaceAlt} />
                <Text style={[styles.caption, { color: t.inkFaint }]}>
                  Recorded sleep per day. Sessions starting between 18:00 and 06:00 count as night.
                </Text>
              </View>
            </View>

            <SectionHeading kicker={windowLabel} title="Care rhythm" />
            <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <View style={styles.metricRow}>
                <Metric value={String(diapers.total)} label="diapers" />
                <Metric value={formatDuration(tummy.totalMin)} label="tummy time" />
                <Metric value={String(medRecords.length)} label="med. doses" />
              </View>
              <View style={{ marginTop: spacing(3) }}>
                <Figure left="Wet" right={String(diapers.wet)} />
                <Figure left="Soiled" right={String(diapers.dirty)} />
                <Figure left="Both" right={String(diapers.both)} />
                {tummy.sessionCount > 0 ? (
                  <Figure left="Tummy-time sessions" right={String(tummy.sessionCount)} />
                ) : null}
              </View>
            </View>

            <SectionHeading kicker={windowLabel} title="Day by day" />
            <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              {activity
                .slice()
                .reverse()
                .slice(0, range === '30d' ? 10 : 7)
                .map((d) => (
                  <Figure
                    key={d.date}
                    left={d.date.slice(5)}
                    right={`${d.feeds} feeds · ${d.diapers} diapers · ${formatDuration(d.sleepMin)} sleep`}
                  />
                ))}
              {range === '30d' ? (
                <Text style={[styles.caption, { color: t.inkFaint, marginTop: spacing(2) }]}>
                  Showing the 10 most recent days of the 30-day window.
                </Text>
              ) : null}
            </View>
          </>
        )}

        {growth.length > 0 ? (
          <>
            <SectionHeading kicker="All time" title="Growth history" />
            <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              {growth
                .slice()
                .reverse()
                .slice(0, 6)
                .map((g) => (
                  <Figure
                    key={g.id}
                    left={g.date}
                    right={[
                      g.weightGrams !== undefined ? formatWeight(g.weightGrams, 'metric') : null,
                      g.heightCm !== undefined ? formatLength(g.heightCm, 'metric') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
            </View>
          </>
        ) : null}

        {milestones.length > 0 ? (
          <>
            <SectionHeading kicker="All time" title="Milestones" />
            <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              {milestones
                .slice()
                .reverse()
                .slice(0, 6)
                .map((m) => (
                  <Figure key={m.id} left={m.date} right={m.title} />
                ))}
              {milestones.length > 6 ? (
                <Text style={[styles.caption, { color: t.inkFaint, marginTop: spacing(2) }]}>
                  {milestones.length - 6} more in the Family journal.
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={[styles.footerNote, { color: t.inkFaint }]}>
          Every figure here comes only from your own records. Gaps stay empty — nothing is
          estimated, averaged into existence, or interpreted as medical advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing(4), paddingBottom: spacing(10) },
  header: { marginBottom: spacing(1) },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing(1),
  },
  title: { fontSize: 34, lineHeight: 40 },
  sectionTitle: { fontSize: 26, lineHeight: 32 },
  panel: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(3.5),
  },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(2) },
  metric: { flex: 1, alignItems: 'flex-start' },
  metricValue: { fontSize: 26, lineHeight: 32, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 12, marginTop: 2 },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  figureLeft: { fontSize: 15, flex: 1 },
  figureRight: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'right' },
  figureNote: { fontSize: 12, marginTop: 2 },
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 3 },
  barLabel: { fontSize: 9, color: '#999', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 12, lineHeight: 17, marginTop: spacing(2) },
  babyRow: { flexDirection: 'row', gap: spacing(1.5), flexWrap: 'wrap' },
  babyChip: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing(6),
    textAlign: 'center',
  },
});
