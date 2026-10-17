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
  Baby,
  Apple,
  Timer,
  Repeat,
  Hourglass,
} from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { babyAge, formatClock, timeAgo } from '@/src/models/time';
import type {
  BottleEvent, BreastFeedEvent, CareEvent, DiaperEvent, MilkType, NoteEvent,
  PumpEvent, SleepEvent, SolidsEvent, TummyTimeEvent,
} from '@/src/models/types';
import { timerElapsedMinutes } from '@/src/models/timers';
import { eventLabel, lastRepeatable } from '@/src/models/repeat';
import { EventRibbonItem, describeEvent } from '@/src/components/EventRibbon';
import { LiveTimerBadge } from '@/src/components/LiveTimerBadge';
import { PrimaryButton, SegmentedControl, EmptyState } from '@/src/components/ui';
import {
  DiaperForm, BottleForm, NoteForm, PumpForm, SolidsForm, ManualDurationForm,
} from '@/src/screens/QuickLog';

type SheetKind =
  | 'diaper' | 'bottle' | 'note' | 'pump' | 'solids'
  | 'manual_sleep' | 'manual_tummy' | 'manual_breast' | 'repeat'
  | 'finish_pump'
  | null;

type NewEventPayload =
  | Omit<DiaperEvent, 'id' | 'babyId' | 'timestamp'>
  | Omit<BottleEvent, 'id' | 'babyId' | 'timestamp'>
  | Omit<NoteEvent, 'id' | 'babyId' | 'timestamp'>
  | Omit<PumpEvent, 'id' | 'babyId' | 'timestamp'>
  | Omit<SolidsEvent, 'id' | 'babyId' | 'timestamp'>
  | Omit<SleepEvent, 'id' | 'babyId' | 'timestamp'>
  | Omit<TummyTimeEvent, 'id' | 'babyId' | 'timestamp'>
  | Omit<BreastFeedEvent, 'id' | 'babyId' | 'timestamp'>;

export default function TodayScreen() {
  const t = useTheme();
  const {
    currentBaby, data, isDemo, addEvent, addTimer, stopTimer,
    pauseActiveTimer, resumeActiveTimer, switchActiveTimerSide,
  } = useApp();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [repeatTarget, setRepeatTarget] = useState<CareEvent | null>(null);
  const [finishPumpId, setFinishPumpId] = useState<string | null>(null);
  const [finishPumpSide, setFinishPumpSide] = useState<'left' | 'right' | 'both'>('both');
  const [toast, setToast] = useState<string | null>(null);

  const events = useMemo(() => {
    if (!currentBaby) return [];
    return data.events
      .filter((e) => e.babyId === currentBaby.id)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [data.events, currentBaby]);

  const activeTimers = useMemo(
    () => data.activeTimers.filter((tm) => tm.babyId === currentBaby?.id),
    [data.activeTimers, currentBaby]
  );

  const lastOf = (type: CareEvent['type']) => events.find((e) => e.type === type);
  const lastDiaper = lastOf('diaper');
  const lastFeed = events.find((e) => e.type === 'feed_bottle' || e.type === 'feed_breast');
  const lastSleep = lastOf('sleep');
  const repeatable = lastRepeatable(events);

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

  const nowIso = () => new Date().toISOString();

  const startTimer = async (kind: 'feed_breast' | 'sleep' | 'pump' | 'tummy_time', side?: 'left' | 'right') => {
    if (!currentBaby) return;
    const now = nowIso();
    const ok = await addTimer({
      id: crypto.randomUUID(),
      babyId: currentBaby.id,
      kind,
      startedAt: now,
      ...(side ? { side, lastSide: side } : {}),
      segments: [{ start: now, end: null }],
      ...(isDemo ? { isDemo: true } : {}),
    });
    if (ok) showToast(`${eventLabel(kind)} timer started${side ? ` (${side})` : ''}`);
    else showToast('Could not start the timer');
  };

  const handlePause = async (timerId: string) => {
    const ok = await pauseActiveTimer(timerId);
    showToast(ok ? 'Paused' : 'Could not pause the timer');
  };

  const handleResume = async (timerId: string) => {
    const ok = await resumeActiveTimer(timerId);
    showToast(ok ? 'Running again' : 'Could not resume the timer');
  };

  const handleSwitchSide = async (timerId: string, side: 'left' | 'right') => {
    const ok = await switchActiveTimerSide(timerId, side);
    showToast(ok ? `Switched to ${side}` : 'Could not switch sides');
  };

  const handleFinish = async (timerId: string, kind: string) => {
    const timer = activeTimers.find((tm) => tm.id === timerId);
    if (!timer) return;
    if (kind === 'pump') {
      setFinishPumpSide(timer.side ?? 'both');
      setFinishPumpId(timerId);
      setSheet('finish_pump');
      return;
    }
    const ok = await stopTimer(timerId);
    showToast(ok ? 'Saved to the journal' : 'Could not save — please try again');
  };

  const finishPumpSave = async (amountMl: number, note?: string) => {
    if (!finishPumpId) return;
    const timer = activeTimers.find((tm) => tm.id === finishPumpId);
    const durationMin = timer ? Math.round(timerElapsedMinutes(timer)) : undefined;
    const ok = await stopTimer(finishPumpId, {
      ...(durationMin !== undefined ? { durationMin } : {}),
      amountMl,
      side: finishPumpSide,
      ...(note?.trim() ? { note: note.trim() } : {}),
    });
    setFinishPumpId(null);
    setSheet(null);
    showToast(ok ? 'Pumping session saved' : 'Could not save — please try again');
  };

  const persistNewEvent = async (payload: NewEventPayload) => {
    if (!currentBaby) return;
    const ok = await addEvent({
      ...payload,
      id: crypto.randomUUID(),
      babyId: currentBaby.id,
      timestamp: nowIso(),
      ...(isDemo ? { isDemo: true } : {}),
    } as CareEvent);
    setSheet(null);
    showToast(ok ? 'Saved to the journal' : 'Could not save');
  };

  const openRepeatSheet = () => {
    if (!repeatable) return;
    setRepeatTarget(repeatable);
    setSheet('repeat');
  };

  const saveDiaper = (d: Omit<DiaperEvent, 'id' | 'babyId' | 'timestamp'>) => persistNewEvent(d);
  const saveBottle = (b: Omit<BottleEvent, 'id' | 'babyId' | 'timestamp'>) => persistNewEvent(b);
  const savePump = (p: Omit<PumpEvent, 'id' | 'babyId' | 'timestamp'>) => persistNewEvent(p);
  const saveSolids = (s: Omit<SolidsEvent, 'id' | 'babyId' | 'timestamp'>) => persistNewEvent(s);
  const saveTimed = (
    e: Omit<SleepEvent | TummyTimeEvent | BreastFeedEvent, 'id' | 'babyId' | 'timestamp'>
  ) => persistNewEvent(e as NewEventPayload);
  const saveNote = (n: Omit<NoteEvent, 'id' | 'babyId' | 'timestamp'>) => persistNewEvent(n);

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

  const repeatFormFor = (e: CareEvent) => {
    switch (e.type) {
      case 'feed_bottle':
        return <BottleForm onCancel={() => setSheet(null)} onSave={saveBottle} initial={{ amountMl: e.amountMl, milkType: e.milkType, note: e.note }} />;
      case 'feed_breast':
        return <ManualDurationForm title="Repeat breastfeed" unitLabel="Breastfeed" max={240} kind="feed_breast" showSide onCancel={() => setSheet(null)} onSave={saveTimed} initial={{ durationMin: e.durationMin, side: e.side, note: e.note }} />;
      case 'feed_solids':
        return <SolidsForm onCancel={() => setSheet(null)} onSave={saveSolids} initial={{ foodDescription: e.foodDescription, reaction: e.reaction, note: e.note }} />;
      case 'diaper':
        return <DiaperForm onCancel={() => setSheet(null)} onSave={saveDiaper} initial={{ diaperType: e.diaperType, note: e.note }} />;
      case 'sleep':
        return <ManualDurationForm title="Repeat sleep" unitLabel="Sleep" max={1440} kind="sleep" onCancel={() => setSheet(null)} onSave={saveTimed} initial={{ durationMin: e.durationMin, note: e.note }} />;
      case 'pump':
        return <PumpForm onCancel={() => setSheet(null)} onSave={savePump} initial={{ side: e.side ?? 'both', amountMl: e.amountMl, durationMin: e.durationMin, note: e.note }} />;
      case 'tummy_time':
        return <ManualDurationForm title="Repeat tummy time" unitLabel="Tummy time" max={240} kind="tummy_time" onCancel={() => setSheet(null)} onSave={saveTimed} initial={{ durationMin: e.durationMin, note: e.note }} />;
      default:
        return null;
    }
  };

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

        {activeTimers.length > 0 && (
          <View style={{ marginTop: spacing(3), gap: spacing(2) }}>
            {activeTimers.map((tm) => (
              <LiveTimerBadge
                key={tm.id}
                timer={tm}
                actions={{
                  onPause: () => handlePause(tm.id),
                  onResume: () => handleResume(tm.id),
                  ...(tm.kind === 'feed_breast'
                    ? { onSwitchSide: (side: 'left' | 'right') => handleSwitchSide(tm.id, side) }
                    : {}),
                  onFinish: () => handleFinish(tm.id, tm.kind),
                }}
              />
            ))}
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
              onPress={() => startTimer('feed_breast', 'left')}
            />
            <DockButton
              icon={<Hand size={24} color={t.accent} strokeWidth={2} />}
              label="Right"
              onPress={() => startTimer('feed_breast', 'right')}
            />
            <DockButton
              icon={<Moon size={24} color={t.accent} strokeWidth={2} />}
              label="Sleep"
              onPress={() => startTimer('sleep')}
            />
          </View>
          <View style={styles.dock}>
            <DockButton
              icon={<Hourglass size={24} color={t.accent} strokeWidth={2} />}
              label="Pump"
              onPress={() => startTimer('pump')}
            />
            <DockButton
              icon={<Baby size={24} color={t.accent} strokeWidth={2} />}
              label="Tummy"
              onPress={() => startTimer('tummy_time')}
            />
            <DockButton
              icon={<Apple size={24} color={t.accent} strokeWidth={2} />}
              label="Solids"
              onPress={() => setSheet('solids')}
            />
            <DockButton
              icon={<Timer size={24} color={t.accent} strokeWidth={2} />}
              label="Manual"
              onPress={() => setSheet('manual_breast')}
            />
            <DockButton
              icon={<Repeat size={24} color={t.accent} strokeWidth={2} />}
              label="Repeat"
              onPress={openRepeatSheet}
            />
          </View>
          <View style={styles.manualRow}>
            <Text
              style={[styles.manualLink, styles.manualLinkHit, { color: t.cinnamon }]}
              onPress={() => setSheet('manual_sleep')}
              accessibilityRole="button"
              accessibilityLabel="Log a past sleep manually"
            >
              Log past sleep
            </Text>
            <Text style={[styles.manualSep, { color: t.inkFaint }]}>·</Text>
            <Text
              style={[styles.manualLink, styles.manualLinkHit, { color: t.cinnamon }]}
              onPress={() => setSheet('manual_tummy')}
              accessibilityRole="button"
              accessibilityLabel="Log past tummy time manually"
            >
              Log past tummy time
            </Text>
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
            {sheet === 'diaper' && <DiaperForm onCancel={() => setSheet(null)} onSave={saveDiaper} />}
            {sheet === 'bottle' && <BottleForm onCancel={() => setSheet(null)} onSave={saveBottle} />}
            {sheet === 'note' && <NoteForm onCancel={() => setSheet(null)} onSave={saveNote} />}
            {sheet === 'solids' && <SolidsForm onCancel={() => setSheet(null)} onSave={saveSolids} />}
            {sheet === 'manual_breast' && (
              <ManualDurationForm title="Manual breastfeed" unitLabel="Breastfeed" max={240} kind="feed_breast" showSide onCancel={() => setSheet(null)} onSave={saveTimed} />
            )}
            {sheet === 'manual_sleep' && (
              <ManualDurationForm title="Log past sleep" unitLabel="Sleep" max={1440} kind="sleep" onCancel={() => setSheet(null)} onSave={saveTimed} />
            )}
            {sheet === 'manual_tummy' && (
              <ManualDurationForm title="Log past tummy time" unitLabel="Tummy time" max={240} kind="tummy_time" onCancel={() => setSheet(null)} onSave={saveTimed} />
            )}
            {sheet === 'repeat' && repeatTarget && (
              <>
                <Text style={[styles.repeatHint, { color: t.inkMuted }]}>
                  Repeating your last {eventLabel(repeatTarget.type)} — {describeEvent(repeatTarget)}. Edit anything, then save. It gets a fresh timestamp.
                </Text>
                {repeatFormFor(repeatTarget)}
              </>
            )}
            {sheet === 'finish_pump' && (
              <FinishPumpForm
                side={finishPumpSide}
                onSideChange={setFinishPumpSide}
                onCancel={() => {
                  setFinishPumpId(null);
                  setSheet(null);
                }}
                onSave={finishPumpSave}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FinishPumpForm({
  side, onSideChange, onSave, onCancel,
}: {
  side: 'left' | 'right' | 'both';
  onSideChange: (s: 'left' | 'right' | 'both') => void;
  onSave: (amountMl: number, note?: string) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const amt = Number(amount);
    if (!amount.trim() || Number.isNaN(amt) || amt < 0 || amt > 2000) {
      setError('Enter the amount pumped in mL (0–2000), or 0 if you pumped nothing.');
      return;
    }
    onSave(Math.round(amt), note.trim() || undefined);
  };

  return (
    <View>
      <Text style={[styles.sheetTitle, { color: t.ink }]}>Finish pumping</Text>
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Side</Text>
      <SegmentedControl
        label="Pumping side"
        options={[
          { value: 'left' as const, label: 'Left' },
          { value: 'right' as const, label: 'Right' },
          { value: 'both' as const, label: 'Both' },
        ]}
        value={side}
        onChange={onSideChange}
      />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Amount (mL)</Text>
      <TextInput
        style={[styles.inputLike, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={amount}
        onChangeText={setAmount}
        placeholder="90"
        placeholderTextColor={t.inkFaint}
        keyboardType="number-pad"
        maxLength={5}
        accessibilityLabel="Amount pumped in millilitres"
      />
      <TextInput
        style={[styles.inputLikeMultiline, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={note}
        onChangeText={setNote}
        placeholder="Optional note"
        placeholderTextColor={t.inkFaint}
        maxLength={500}
        multiline
        accessibilityLabel="Pumping note"
      />
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label="Save pumping session" onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
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
    paddingBottom: spacing(10),
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
    marginBottom: spacing(1.5),
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
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(1),
  },
  manualLink: {
    fontSize: 14,
    fontWeight: '600',
    minHeight: 32,
  },
  manualLinkHit: { marginTop: -8, marginBottom: -8, paddingTop: 8, paddingBottom: 8 },

  manualSep: {
    fontSize: 14,
  },
  repeatHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing(2),
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing(1),
    marginTop: spacing(3),
  },
  inputLike: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  inputLikeMultiline: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
    fontSize: 15,
    marginTop: spacing(3),
    textAlignVertical: 'top',
  },
  error: {
    marginTop: spacing(2),
    fontSize: 14,
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
    bottom: spacing(10),
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
});
