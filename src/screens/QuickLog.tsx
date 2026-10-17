import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';
import { PrimaryButton, SegmentedControl } from '@/src/components/ui';
import type {
  BottleEvent, BreastFeedEvent, DiaperEvent, MilkType, NoteEvent,
  PumpEvent, SleepEvent, SolidsEvent, TummyTimeEvent,
} from '@/src/models/types';
import { ozToMl, mlToOz } from '@/src/models/timers';

function SheetHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={styles.closeBtn}
      >
        <X size={20} color={t.inkMuted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

export function DiaperForm({
  onCancel,
  onSave,
  initial,
}: {
  onCancel: () => void;
  onSave: (d: Omit<DiaperEvent, 'id' | 'babyId' | 'timestamp'>) => void;
  initial?: { diaperType?: 'wet' | 'dirty' | 'both'; note?: string };
}) {
  const t = useTheme();
  const [diaperType, setDiaperType] = useState<'wet' | 'dirty' | 'both'>(initial?.diaperType ?? 'wet');
  const [note, setNote] = useState(initial?.note ?? '');

  return (
    <View>
      <SheetHeader title="Diaper change" onCancel={onCancel} />
      <SegmentedControl
        label="Diaper contents"
        options={[
          { value: 'wet', label: 'Wet' },
          { value: 'dirty', label: 'Dirty' },
          { value: 'both', label: 'Both' },
        ]}
        value={diaperType}
        onChange={setDiaperType}
      />
      <TextInput
        style={[styles.noteInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={note}
        onChangeText={setNote}
        placeholder="Optional note (rash, cream…)"
        placeholderTextColor={t.inkFaint}
        maxLength={500}
        multiline
        accessibilityLabel="Diaper note"
      />
      <PrimaryButton
        label="Save diaper change"
        onPress={() => onSave({ type: 'diaper', diaperType, ...(note.trim() ? { note: note.trim() } : {}) })}
        style={{ marginTop: spacing(3), minHeight: 52 }}
      />
    </View>
  );
}

export function BottleForm({
  onCancel,
  onSave,
  initial,
}: {
  onCancel: () => void;
  onSave: (b: Omit<BottleEvent, 'id' | 'babyId' | 'timestamp'>) => void;
  initial?: { amountMl?: number; milkType?: MilkType; note?: string };
}) {
  const t = useTheme();
  const [amount, setAmount] = useState(initial?.amountMl !== undefined ? String(initial.amountMl) : '');
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml');
  const [milkType, setMilkType] = useState<MilkType>(initial?.milkType ?? 'formula');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const n = Number(amount);
    if (!amount.trim() || Number.isNaN(n) || n <= 0) {
      setError('Enter the amount fed.');
      return;
    }
    const ml = unit === 'ml' ? n : ozToMl(n);
    if (ml <= 0 || ml > 2000) {
      setError('Amount must be between 1 mL and 2000 mL.');
      return;
    }
    onSave({ type: 'feed_bottle', amountMl: Math.round(ml), milkType, ...(initial?.note?.trim() ? { note: initial.note.trim() } : {}) });
  };

  return (
    <View>
      <SheetHeader title="Bottle feed" onCancel={onCancel} />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Amount</Text>
      <View style={styles.amountRow}>
        <TextInput
          style={[styles.amountInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
          value={amount}
          onChangeText={setAmount}
          placeholder={unit === 'ml' ? '120' : '4'}
          placeholderTextColor={t.inkFaint}
          keyboardType="number-pad"
          maxLength={6}
          accessibilityLabel={`Amount in ${unit === 'ml' ? 'millilitres' : 'ounces'}`}
        />
        <View style={{ width: 110 }}>
          <SegmentedControl
            label="Unit"
            options={[
              { value: 'ml' as const, label: 'mL' },
              { value: 'oz' as const, label: 'oz' },
            ]}
            value={unit}
            onChange={setUnit}
          />
        </View>
      </View>
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Milk type</Text>
      <SegmentedControl
        label="Milk type"
        options={[
          { value: 'breast_milk' as MilkType, label: 'Breast milk' },
          { value: 'formula' as MilkType, label: 'Formula' },
          { value: 'mixed' as MilkType, label: 'Mixed' },
        ]}
        value={milkType}
        onChange={setMilkType}
      />
      {amount.trim() && !Number.isNaN(Number(amount)) && (
        <Text style={[styles.conversion, { color: t.inkMuted }]}>
          = {Math.round(unit === 'ml' ? Number(amount) : ozToMl(Number(amount)))} mL
          {unit === 'ml' ? ` · ${mlToOz(Number(amount)).toFixed(1)} oz` : ''}
        </Text>
      )}
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label="Save bottle feed" onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

export function PumpForm({
  onCancel,
  onSave,
  initial,
}: {
  onCancel: () => void;
  onSave: (p: Omit<PumpEvent, 'id' | 'babyId' | 'timestamp'>) => void;
  initial?: { side?: 'left' | 'right' | 'both'; amountMl?: number; durationMin?: number; note?: string };
}) {
  const t = useTheme();
  const [side, setSide] = useState<'left' | 'right' | 'both'>(initial?.side ?? 'both');
  const [amount, setAmount] = useState(initial?.amountMl !== undefined ? String(initial.amountMl) : '');
  const [duration, setDuration] = useState(initial?.durationMin !== undefined ? String(initial.durationMin) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const amt = Number(amount);
    const dur = Number(duration);
    if (!amount.trim() || Number.isNaN(amt) || amt < 0 || amt > 2000) {
      setError('Enter the amount pumped in mL (0–2000).');
      return;
    }
    if (!duration.trim() || Number.isNaN(dur) || dur <= 0 || dur > 240) {
      setError('Enter the pumping duration in minutes (1–240).');
      return;
    }
    onSave({
      type: 'pump',
      amountMl: Math.round(amt),
      durationMin: Math.round(dur),
      side,
      ...(note.trim() ? { note: note.trim() } : {}),
    } as Omit<PumpEvent, 'id' | 'babyId' | 'timestamp'>);
  };

  return (
    <View>
      <SheetHeader title="Pumping session" onCancel={onCancel} />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Side</Text>
      <SegmentedControl
        label="Pumping side"
        options={[
          { value: 'left' as const, label: 'Left' },
          { value: 'right' as const, label: 'Right' },
          { value: 'both' as const, label: 'Both' },
        ]}
        value={side}
        onChange={setSide}
      />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Amount (mL)</Text>
      <TextInput
        style={[styles.amountInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={amount}
        onChangeText={setAmount}
        placeholder="90"
        placeholderTextColor={t.inkFaint}
        keyboardType="number-pad"
        maxLength={5}
        accessibilityLabel="Amount pumped in millilitres"
      />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Duration (minutes)</Text>
      <TextInput
        style={[styles.amountInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={duration}
        onChangeText={setDuration}
        placeholder="15"
        placeholderTextColor={t.inkFaint}
        keyboardType="number-pad"
        maxLength={4}
        accessibilityLabel="Pumping duration in minutes"
      />
      <TextInput
        style={[styles.noteInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
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

export function SolidsForm({
  onCancel,
  onSave,
  initial,
}: {
  onCancel: () => void;
  onSave: (s: Omit<SolidsEvent, 'id' | 'babyId' | 'timestamp'>) => void;
  initial?: { foodDescription?: string; reaction?: 'liked' | 'neutral' | 'refused'; note?: string };
}) {
  const t = useTheme();
  const [food, setFood] = useState(initial?.foodDescription ?? '');
  const [amount, setAmount] = useState('');
  const [reaction, setReaction] = useState<'liked' | 'neutral' | 'refused'>(initial?.reaction ?? 'neutral');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!food.trim()) {
      setError('Describe what was offered.');
      return;
    }
    const detail = amount.trim() ? `${food.trim()} (${amount.trim()})` : food.trim();
    onSave({
      type: 'feed_solids',
      foodDescription: detail,
      reaction,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <View>
      <SheetHeader title="Solid food" onCancel={onCancel} />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Food</Text>
      <TextInput
        style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={food}
        onChangeText={setFood}
        placeholder="Mashed banana"
        placeholderTextColor={t.inkFaint}
        maxLength={200}
        accessibilityLabel="Food description"
      />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Quantity (optional)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={amount}
        onChangeText={setAmount}
        placeholder="about 3 spoons"
        placeholderTextColor={t.inkFaint}
        maxLength={60}
        accessibilityLabel="Quantity offered"
      />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Reaction (as observed, not a diagnosis)</Text>
      <SegmentedControl
        label="Reaction"
        options={[
          { value: 'liked' as const, label: 'Enjoyed' },
          { value: 'neutral' as const, label: 'Neutral' },
          { value: 'refused' as const, label: 'Refused' },
        ]}
        value={reaction}
        onChange={setReaction}
      />
      <TextInput
        style={[styles.noteInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={note}
        onChangeText={setNote}
        placeholder="Optional observation"
        placeholderTextColor={t.inkFaint}
        maxLength={500}
        multiline
        accessibilityLabel="Solids note"
      />
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label="Save solid food entry" onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

export function ManualDurationForm({
  title,
  unitLabel,
  max,
  kind,
  onCancel,
  onSave,
  showSide,
  initial,
}: {
  title: string;
  unitLabel: string;
  max: number;
  kind: 'sleep' | 'tummy_time' | 'feed_breast';
  onCancel: () => void;
  onSave: (e: Omit<SleepEvent | TummyTimeEvent | BreastFeedEvent, 'id' | 'babyId' | 'timestamp'>) => void;
  showSide?: boolean;
  initial?: { durationMin?: number; side?: 'left' | 'right' | 'both'; note?: string };
}) {
  const t = useTheme();
  const initTotal = initial?.durationMin ?? 0;
  const [hours, setHours] = useState(initTotal ? String(Math.floor(initTotal / 60)) : '');
  const [minutes, setMinutes] = useState(initTotal % 60 ? String(initTotal % 60) : '');
  const [side, setSide] = useState<'left' | 'right' | 'both'>(initial?.side ?? 'both');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const h = Number(hours) || 0;
    const m = Number(minutes) || 0;
    const total = Math.round(h * 60 + m);
    if (total <= 0) {
      setError('Enter a duration greater than zero.');
      return;
    }
    if (total > max) {
      setError(`Duration cannot exceed ${Math.floor(max / 60)} hours.`);
      return;
    }
    if (kind === 'feed_breast') {
      onSave({ type: 'feed_breast', durationMin: total, side, ...(note.trim() ? { note: note.trim() } : {}) } as Omit<BreastFeedEvent, 'id' | 'babyId' | 'timestamp'>);
    } else {
      onSave({ type: kind, durationMin: total, ...(note.trim() ? { note: note.trim() } : {}) } as Omit<SleepEvent | TummyTimeEvent, 'id' | 'babyId' | 'timestamp'>);
    }
  };

  return (
    <View>
      <SheetHeader title={title} onCancel={onCancel} />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Duration</Text>
      <View style={styles.amountRow}>
        <TextInput
          style={[styles.amountInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
          value={hours}
          onChangeText={setHours}
          placeholder="0"
          placeholderTextColor={t.inkFaint}
          keyboardType="number-pad"
          maxLength={3}
          accessibilityLabel={`${unitLabel} hours`}
        />
        <Text style={[styles.unitText, { color: t.inkMuted }]}>h</Text>
        <TextInput
          style={[styles.amountInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
          value={minutes}
          onChangeText={setMinutes}
          placeholder="0"
          placeholderTextColor={t.inkFaint}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={`${unitLabel} minutes`}
        />
        <Text style={[styles.unitText, { color: t.inkMuted }]}>m</Text>
      </View>
      {showSide && (
        <>
          <Text style={[styles.fieldLabel, { color: t.ink }]}>Side</Text>
          <SegmentedControl
            label="Feeding side"
            options={[
              { value: 'left' as const, label: 'Left' },
              { value: 'right' as const, label: 'Right' },
              { value: 'both' as const, label: 'Both' },
            ]}
            value={side}
            onChange={setSide}
          />
        </>
      )}
      <TextInput
        style={[styles.noteInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={note}
        onChangeText={setNote}
        placeholder="Optional note"
        placeholderTextColor={t.inkFaint}
        maxLength={500}
        multiline
        accessibilityLabel={`${title} note`}
      />
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label={`Save ${unitLabel.toLowerCase()}`} onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

export function NoteForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (n: Omit<NoteEvent, 'id' | 'babyId' | 'timestamp'>) => void;
}) {
  const t = useTheme();
  const [note, setNote] = useState('');

  return (
    <View>
      <SheetHeader title="A quiet note" onCancel={onCancel} />
      <TextInput
        style={[
          styles.noteInput,
          { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline, minHeight: 110 },
        ]}
        value={note}
        onChangeText={setNote}
        placeholder="Something worth remembering…"
        placeholderTextColor={t.inkFaint}
        maxLength={500}
        multiline
        autoFocus
        accessibilityLabel="Note text"
      />
      <PrimaryButton
        label="Save note"
        onPress={() => {
          if (note.trim()) onSave({ type: 'note', note: note.trim() });
        }}
        disabled={!note.trim()}
        style={{ marginTop: spacing(3), minHeight: 52 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing(1),
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing(1),
    marginTop: spacing(3),
  },
  amountInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    fontSize: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
  },
  unitText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 18,
  },
  conversion: {
    marginTop: spacing(2),
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  noteInput: {
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
});
