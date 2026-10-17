import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Milk,
  Moon,
  Shirt,
  Hand,
  Plus,
  Check,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { babyAge, formatClock, timeAgo } from '@/src/models/time';
import type { CareEvent, DiaperEvent, BottleEvent, NoteEvent } from '@/src/models/types';
import { EventRibbonItem } from '@/src/components/EventRibbon';
import { LiveTimerBadge } from '@/src/components/LiveTimerBadge';
import { PrimaryButton, SegmentedControl, EmptyState } from '@/src/components/ui';
import { DiaperForm, BottleForm, NoteForm } from '@/src/screens/QuickLog';

type SheetKind = 'diaper' | 'bottle' | 'note' | null;

export default function TodayScreen() {
  const t = useTheme();
  const { currentBaby, data, isDemo, addEvent, addTimer, stopTimer } = useApp();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [toast, setToast] = useState<string | null>(null);

  const events = useMemo(() => {
    if (!currentBaby) return [];
    return data.events
      .filter((e) => e.babyId === currentBaby.id)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [data.events, currentBaby]);

  const activeTimer = useMemo(
    () => data.activeTimers.find((tm) => tm.babyId === currentBaby?.id) ?? null,
    [data.activeTimers, currentBaby]
  );

  const lastOf = (type: CareEvent['type']) => events.find((e) => e.type === type);
  const lastDiaper = lastOf('diaper');
  const lastFeed = events.find((e) => e.type === 'feed_bottle' || e.type === 'feed_breast');
  const lastSleep = lastOf('sleep');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Still awake';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const startBreastTimer = async (side: 'left' | 'right') => {
    if (!currentBaby) return;
    const ok = await addTimer({
      id: crypto.randomUUID(),
      babyId: currentBaby.id,
      kind: 'feed_breast',
      startedAt: new Date().toISOString(),
      side,
      ...(isDemo ? { isDemo: true } : {}),
    });
    if (ok) showToast('Breastfeeding timer started');
    else showToast('Could not start the timer');
  };

  const startSleepTimer = async () => {
    if (!currentBaby) return;
    const ok = await addTimer({
      id: crypto.randomUUID(),
      babyId: currentBaby.id,
      kind: 'sleep',
      startedAt: new Date().toISOString(),
      ...(isDemo ? { isDemo: true } : {}),
    });
    if (ok) showToast('Sleep timer started');
    else showToast('Could not start the timer');
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    const durationMin = (Date.now() - new Date(activeTimer.startedAt).getTime()) / 60000;
    const ok = await stopTimer(activeTimer.id, durationMin);
    showToast(ok ? 'Saved to the journal' : 'Could not save — please try again');
  };

  const saveDiaper = async (d: Omit<DiaperEvent, 'id' | 'babyId' | 'timestamp'>) => {
    if (!currentBaby) return;
    const ok = await addEvent({
      ...d,
      id: crypto.randomUUID(),
      babyId: currentBaby.id,
      timestamp: new Date().toISOString(),
      ...(isDemo ? { isDemo: true } : {}),
    } as DiaperEvent);
    showToast(ok ? 'Diaper change recorded' : 'Could not save');
  };

  const saveBottle = async (b: Omit<BottleEvent, 'id' | 'babyId' | 'timestamp'>) => {
    if (!currentBaby) return;
    const ok = await addEvent({
      ...b,
      id: crypto.randomUUID(),
      babyId: currentBaby.id,
      timestamp: new Date().toISOString(),
      ...(isDemo ? { isDemo: true } : {}),
    } as BottleEvent);
    showToast(ok ? 'Bottle feed recorded' : 'Could not save');
  };

  const saveNote = async (n: Omit<NoteEvent, 'id' | 'babyId' | 'timestamp'>) => {
    if (!currentBaby) return;
    const ok = await addEvent({
      ...n,
      id: crypto.randomUUID(),
      babyId: currentBaby.id,
      timestamp: new Date().toISOString(),
      ...(isDemo ? { isDemo: true } : {}),
    } as NoteEvent);
    showToast(ok ? 'Note saved' : 'Could not save');
  };

  if (!currentBaby) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]}>
        <EmptyState
          title="No baby profile yet"
          body="Create a profile to start recording care events."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: t.inkMuted }]}>{greeting()}</Text>
            <Text style={[styles.babyName, { color: t.ink, fontFamily: fontNames.display }]}>
              {currentBaby.name}
            </Text>
            <Text style={[styles.age, { color: t.cinnamon }]}>
              {babyAge(currentBaby.birthDate)}
              {isDemo ? ' · demo data' : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.statusBand, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <StatusCell
            label="Last feed"
            value={lastFeed ? timeAgo(lastFeed.timestamp) : '—'}
            detail={lastFeed ? formatClock(lastFeed.timestamp) : 'nothing recorded'}
          />
          <View style={[styles.divider, { backgroundColor: t.hairline }]} />
          <StatusCell
            label="Last diaper"
            value={lastDiaper ? timeAgo(lastDiaper.timestamp) : '—'}
            detail={lastDiaper ? formatClock(lastDiaper.timestamp) : 'nothing recorded'}
          />
          <View style={[styles.divider, { backgroundColor: t.hairline }]} />
          <StatusCell
            label="Last sleep"
            value={lastSleep && lastSleep.type === 'sleep' ? `${Math.round(lastSleep.durationMin)}m` : '—'}
            detail={lastSleep ? formatClock(lastSleep.timestamp) : 'nothing recorded'}
          />
        </View>

        {activeTimer && (
          <View style={{ marginTop: spacing(3) }}>
            <LiveTimerBadge timer={activeTimer} onStop={handleStopTimer} />
          </View>
        )}

        <View style={styles.dockWrap}>
          <Text style={[styles.dockLabel, { color: t.inkMuted }]}>QUICK LOG</Text>
          <View style={styles.dock}>
            <DockButton
              icon={<Shirt size={24} color={t.accent} strokeWidth={2} />}
              label="Diaper"
              onPress={() => setSheet('diaper')}
            />
            <DockButton
              icon={<Milk size={24} color={t.accent} strokeWidth={2} />}
              label="Bottle"
              onPress={() => setSheet('bottle')}
            />
            <DockButton
              icon={<Hand size={24} color={t.accent} strokeWidth={2} />}
              label="Left"
              onPress={() => startBreastTimer('left')}
            />
            <DockButton
              icon={<Hand size={24} color={t.accent} strokeWidth={2} />}
              label="Right"
              onPress={() => startBreastTimer('right')}
            />
            <DockButton
              icon={<Moon size={24} color={t.accent} strokeWidth={2} />}
              label="Sleep"
              onPress={() => startSleepTimer()}
            />
          </View>
        </View>

        <View style={styles.ribbon}>
          <Text style={[styles.ribbonTitle, { color: t.ink }]}>Today's ribbon</Text>
          {events.length === 0 ? (
            <EmptyState
              title="A quiet day so far"
              body="Care events you log will appear here as a gentle timeline."
            />
          ) : (
            events.slice(0, 12).map((e) => <EventRibbonItem key={e.id} event={e} />)
          )}
        </View>
      </ScrollView>

      {/* Floating note button */}
      <Pressable
        onPress={() => setSheet('note')}
        accessibilityRole="button"
        accessibilityLabel="Add a note"
        style={[styles.fab, { backgroundColor: t.cinnamon }]}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: t.ink }]} accessibilityLiveRegion="polite">
          <Check size={16} color={t.canvas} strokeWidth={2.5} />
          <Text style={[styles.toastText, { color: t.canvas }]}>{toast}</Text>
        </View>
      )}

      <Modal visible={sheet !== null} animationType="slide" transparent onRequestClose={() => setSheet(null)}>
        <View style={[styles.sheetBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
          <View style={[styles.sheet, { backgroundColor: t.canvas }]}>
            <View style={styles.sheetHandle}>
              <View style={[styles.handleBar, { backgroundColor: t.hairline }]} />
            </View>
            {sheet === 'diaper' && (
              <DiaperForm onCancel={() => setSheet(null)} onSave={saveDiaper} />
            )}
            {sheet === 'bottle' && (
              <BottleForm onCancel={() => setSheet(null)} onSave={saveBottle} />
            )}
            {sheet === 'note' && (
              <NoteForm onCancel={() => setSheet(null)} onSave={saveNote} />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatusCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  const t = useTheme();
  return (
    <View style={styles.statusCell}>
      <Text style={[styles.statusLabel, { color: t.inkMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.statusValue, { color: t.ink }]}>{value}</Text>
      <Text style={[styles.statusDetail, { color: t.inkFaint }]}>{detail}</Text>
    </View>
  );
}

function DockButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Log ${label}`}
      style={({ pressed }) => [
        styles.dockBtn,
        { backgroundColor: t.surfaceAlt, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
      <Text style={[styles.dockBtnLabel, { color: t.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: spacing(4),
    paddingBottom: spacing(14),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  babyName: {
    fontSize: 34,
    lineHeight: 40,
    marginTop: spacing(1),
  },
  age: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing(1),
  },
  statusBand: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing(4),
    paddingVertical: spacing(3),
  },
  statusCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing(1),
  },
  statusLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: spacing(1),
  },
  statusDetail: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  divider: { width: StyleSheet.hairlineWidth },
  dockWrap: { marginTop: spacing(5) },
  dockLabel: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  dock: {
    flexDirection: 'row',
    gap: spacing(1.5),
  },
  dockBtn: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
    paddingVertical: spacing(1.5),
  },
  dockBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  ribbon: { marginTop: spacing(6) },
  ribbonTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  fab: {
    position: 'absolute',
    right: spacing(4),
    bottom: spacing(14),
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    bottom: spacing(16),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    minHeight: 44,
    borderRadius: radius.pill,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing(6),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
    maxHeight: '85%',
  },
  sheetHandle: { alignItems: 'center', marginBottom: spacing(2) },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
});
