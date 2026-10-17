import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';
import { PrimaryButton, SegmentedControl } from '@/src/components/ui';
import type { BottleEvent, DiaperEvent, MilkType, NoteEvent } from '@/src/models/types';

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
}: {
  onCancel: () => void;
  onSave: (d: Omit<DiaperEvent, 'id' | 'babyId' | 'timestamp'>) => void;
}) {
  const t = useTheme();
  const [diaperType, setDiaperType] = useState<'wet' | 'dirty' | 'both'>('wet');
  const [note, setNote] = useState('');

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
}: {
  onCancel: () => void;
  onSave: (b: Omit<BottleEvent, 'id' | 'babyId' | 'timestamp'>) => void;
}) {
  const t = useTheme();
  const [amount, setAmount] = useState('');
  const [milkType, setMilkType] = useState<MilkType>('formula');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const n = Number(amount);
    if (!amount.trim() || Number.isNaN(n) || n <= 0 || n > 2000) {
      setError('Enter the amount in mL (between 1 and 2000).');
      return;
    }
    onSave({ type: 'feed_bottle', amountMl: Math.round(n), milkType });
  };

  return (
    <View>
      <SheetHeader title="Bottle feed" onCancel={onCancel} />
      <Text style={[styles.fieldLabel, { color: t.ink }]}>Amount (mL)</Text>
      <TextInput
        style={[styles.amountInput, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
        value={amount}
        onChangeText={setAmount}
        placeholder="120"
        placeholderTextColor={t.inkFaint}
        keyboardType="number-pad"
        maxLength={5}
        accessibilityLabel="Amount in millilitres"
      />
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
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label="Save bottle feed" onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
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
