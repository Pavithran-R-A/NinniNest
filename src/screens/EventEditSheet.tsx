import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import type { CareEvent } from '@/src/models/types';
import { PrimaryButton, SegmentedControl } from '@/src/components/ui';

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.closeBtn}
      >
        <X size={20} color={t.inkMuted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function timeParts(iso: string): { date: string; hours: string; minutes: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hours: pad(d.getHours()),
    minutes: pad(d.getMinutes()),
  };
}

export function EventEditSheet({ event, onClose }: { event: CareEvent; onClose: () => void }) {
  const t = useTheme();
  const { updateEvent } = useApp();
  const [error, setError] = useState<string | null>(null);

  // Time correction
  const parts = timeParts(event.timestamp);
  const [date, setDate] = useState(parts.date);
  const [hours, setHours] = useState(parts.hours);
  const [minutes, setMinutes] = useState(parts.minutes);

  // Number-based fields
  const [amount, setAmount] = useState(
    event.type === 'feed_bottle' || event.type === 'pump' ? String(event.amountMl) : ''
  );
  const [duration, setDuration] = useState(
    'durationMin' in event && typeof event.durationMin === 'number' ? String(event.durationMin) : ''
  );
  const [note, setNote] = useState(event.note ?? '');
  const [milkType, setMilkType] = useState(
    event.type === 'feed_bottle' ? event.milkType : 'formula'
  );
  const [side, setSide] = useState(event.type === 'feed_breast' ? event.side : 'both');
  const [diaperType, setDiaperType] = useState(
    event.type === 'diaper' ? event.diaperType : 'wet'
  );
  const [food, setFood] = useState(event.type === 'feed_solids' ? event.foodDescription : '');

  const buildTimestamp = (): string | null => {
    const h = Number(hours);
    const m = Number(minutes);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) {
      setError('Time is not valid. Use a YYYY-MM-DD date and 0–23 hours, 0–59 minutes.');
      return null;
    }
    const ts = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    if (Number.isNaN(ts.getTime())) {
      setError('That date and time do not exist.');
      return null;
    }
    if (ts.getTime() > Date.now()) {
      setError('This entry is in the future. Pick a time that already happened.');
      return null;
    }
    return ts.toISOString();
  };

  const save = async () => {
    const timestamp = buildTimestamp();
    if (!timestamp) return;
    let updated: CareEvent = { ...event, timestamp };
    const n = (s: string) => Number(s);

    switch (event.type) {
      case 'feed_bottle': {
        if (!Number.isFinite(n(amount)) || n(amount) <= 0 || n(amount) > 2000) {
          setError('Enter a valid amount in mL (1–2000).');
          return;
        }
        updated = { ...event, timestamp, amountMl: Math.round(n(amount)), milkType: milkType as 'breast_milk' | 'formula' | 'mixed' };
        break;
      }
      case 'feed_breast':
        if (!Number.isFinite(n(duration)) || n(duration) < 0 || n(duration) > 240) {
          setError('Enter a valid duration in minutes (0–240).');
          return;
        }
        updated = { ...event, timestamp, durationMin: Math.round(n(duration)), side: side as 'left' | 'right' | 'both' };
        break;
      case 'sleep':
      case 'tummy_time':
        if (!Number.isFinite(n(duration)) || n(duration) < 0 || n(duration) > 1440) {
          setError('Enter a valid duration in minutes.');
          return;
        }
        updated = { ...event, timestamp, durationMin: Math.round(n(duration)) };
        break;
      case 'pump':
        if (!Number.isFinite(n(amount)) || n(amount) < 0 || n(amount) > 2000 || !Number.isFinite(n(duration)) || n(duration) < 0 || n(duration) > 240) {
          setError('Enter valid amount (0–2000 mL) and duration (0–240 min).');
          return;
        }
        updated = { ...event, timestamp, amountMl: Math.round(n(amount)), durationMin: Math.round(n(duration)) };
        break;
      case 'feed_solids':
        if (!food.trim()) {
          setError('Describe the food.');
          return;
        }
        updated = { ...event, timestamp, foodDescription: food.trim() };
        break;
      case 'diaper':
        updated = { ...event, timestamp, diaperType: diaperType as 'wet' | 'dirty' | 'both' };
        break;
      case 'note':
        if (!note.trim()) {
          setError('The note cannot be empty.');
          return;
        }
        updated = { ...event, timestamp, note: note.trim() };
        break;
    }

    if (event.type !== 'note' && note.trim()) updated = { ...updated, note: note.trim() } as CareEvent;

    const ok = await updateEvent(updated);
    if (ok) onClose();
    else setError('Could not save the change.');
  };

  const numField = (
    label: string,
    value: string,
    setter: (s: string) => void,
    unit: string
  ) => (
    <>
      <Text style={[styles.label, { color: t.ink }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={value}
        onChangeText={setter}
        keyboardType="number-pad"
        placeholder={unit}
        placeholderTextColor={t.inkFaint}
        accessibilityLabel={label}
      />
    </>
  );

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.canvas }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Header title="Edit entry" onClose={onClose} />
            <Text style={[styles.label, { color: t.ink }]}>When it happened</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.dateInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
                value={date}
                onChangeText={setDate}
                placeholder="2026-10-17"
                placeholderTextColor={t.inkFaint}
                maxLength={10}
                accessibilityLabel="Date, year-month-day"
              />
              <TextInput
                style={[styles.input, styles.timeInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
                value={hours}
                onChangeText={(v) => setHours(v.replace(/\D/g, '').slice(0, 2))}
                placeholder="hh"
                placeholderTextColor={t.inkFaint}
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Hour"
              />
              <Text style={[styles.timeSep, { color: t.inkMuted }]}>:</Text>
              <TextInput
                style={[styles.input, styles.timeInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
                value={minutes}
                onChangeText={(v) => setMinutes(v.replace(/\D/g, '').slice(0, 2))}
                placeholder="mm"
                placeholderTextColor={t.inkFaint}
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Minute"
              />
            </View>
            <Text style={[styles.timeHint, { color: t.inkFaint }]}>
              Your local time. Correct it if you logged late.
            </Text>
            {event.type === 'feed_bottle' && (
              <>
                {numField('Amount', amount, setAmount, 'mL')}
                <Text style={[styles.label, { color: t.ink }]}>Milk type</Text>
                <SegmentedControl
                  options={[
                    { value: 'breast_milk', label: 'Breast milk' },
                    { value: 'formula', label: 'Formula' },
                    { value: 'mixed', label: 'Mixed' },
                  ]}
                  value={milkType}
                  onChange={(v) => setMilkType(v)}
                />
              </>
            )}
            {(event.type === 'feed_breast' || event.type === 'sleep' || event.type === 'tummy_time' || event.type === 'pump') &&
              numField('Duration', duration, setDuration, 'minutes')}
            {event.type === 'feed_breast' && (
              <>
                <Text style={[styles.label, { color: t.ink }]}>Side</Text>
                <SegmentedControl
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'both', label: 'Both' },
                  ]}
                  value={side}
                  onChange={(v) => setSide(v)}
                />
              </>
            )}
            {event.type === 'pump' && numField('Amount', amount, setAmount, 'mL')}
            {event.type === 'feed_solids' && (
              <>
                <Text style={[styles.label, { color: t.ink }]}>Food</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
                  value={food}
                  onChangeText={setFood}
                  accessibilityLabel="Food description"
                />
              </>
            )}
            {event.type === 'diaper' && (
              <>
                <Text style={[styles.label, { color: t.ink }]}>Contents</Text>
                <SegmentedControl
                  options={[
                    { value: 'wet', label: 'Wet' },
                    { value: 'dirty', label: 'Dirty' },
                    { value: 'both', label: 'Both' },
                  ]}
                  value={diaperType}
                  onChange={(v) => setDiaperType(v)}
                />
              </>
            )}
            {event.type !== 'note' && (
              <>
                <Text style={[styles.label, { color: t.ink }]}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add context…"
                  placeholderTextColor={t.inkFaint}
                  accessibilityLabel="Note"
                />
              </>
            )}
            {event.type === 'note' && (
              <>
                <Text style={[styles.label, { color: t.ink }]}>Note</Text>
                <TextInput
                  style={[styles.input, styles.noteInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add context…"
                  placeholderTextColor={t.inkFaint}
                  multiline
                  accessibilityLabel="Note text"
                />
              </>
            )}
            {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
            <PrimaryButton label="Save changes" onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '88%',
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(6),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  title: { fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing(1),
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    fontSize: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
  },
  dateInput: {
    flex: 1,
  },
  timeInput: {
    width: 64,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timeSep: {
    fontSize: 18,
    fontWeight: '700',
  },
  timeHint: {
    fontSize: 12,
    marginTop: spacing(1),
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 14,
    marginTop: spacing(2),
  },
});
