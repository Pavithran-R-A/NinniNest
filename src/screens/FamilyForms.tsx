import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';
import { PrimaryButton, SegmentedControl } from '@/src/components/ui';
import { useI18n } from '@/src/i18n/useI18n';
import { pickPhoto } from '@/src/models/photoPick';
import type { Baby, GrowthRecord, MedicationRecord, MilestoneCategory, MilestoneRecord, RoutineKind, RoutineTemplate, VaccinationRecord } from '@/src/models/types';

function SheetHeader({ title, onCancel, subtitle }: { title: string; onCancel: () => void; subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: t.inkMuted }]}>{subtitle}</Text> : null}
      </View>
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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  const t = useTheme();
  return (
    <View>
      <Text style={[styles.label, { color: t.ink }]}>{label}</Text>
      {children}
      {hint ? <Text style={[styles.hint, { color: t.inkFaint }]}>{hint}</Text> : null}
    </View>
  );
}

function TextInputField({
  value, onChangeText, placeholder, label, maxLength, multiline, accessibilityLabel, keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  accessibilityLabel?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  const t = useTheme();
  return (
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline },
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.inkFaint}
      maxLength={maxLength}
      multiline={multiline}
      keyboardType={keyboardType}
      accessibilityLabel={accessibilityLabel ?? label}
    />
  );
}

// ---- Photo section (shared by baby and milestone forms) ----

function PhotoSection({
  previewUri, onChange, canUsePhotos, previewLabel,
}: {
  previewUri: string | null;
  /** Called with the freshly picked URI, or null when the user requests removal. */
  onChange: (uri: string | null) => void;
  canUsePhotos: boolean;
  previewLabel: string;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [note, setNote] = useState<string | null>(null);

  if (!canUsePhotos) {
    return (
      <Text style={[styles.hint, { color: t.inkFaint }]}>{tr('family.photo.demoNote')}</Text>
    );
  }
  const pick = async () => {
    const result = await pickPhoto();
    if (result.ok && result.uri) {
      setNote(null);
      onChange(result.uri);
      return;
    }
    const key =
      result.error === 'permission' ? 'family.photo.denied'
      : result.error === 'canceled' ? null // silent: a cancel is not an error
      : result.error === 'unreadable' ? 'family.photo.unreadable'
      : 'family.photo.openFailed';
    if (key) setNote(tr(key));
  };
  return (
    <View>
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={styles.photoPreview}
          accessibilityLabel={previewLabel}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.photoButtons}>
        <PrimaryButton
          label={previewUri ? tr('family.photo.replace') : tr('family.photo.add')}
          variant="secondary"
          onPress={() => void pick()}
          accessibilityLabel={previewUri ? tr('family.photo.replace') : tr('family.photo.add')}
        />
        {previewUri ? (
          <PrimaryButton
            label={tr('family.photo.remove')}
            variant="secondary"
            onPress={() => {
              setNote(null);
              onChange(null);
            }}
            accessibilityLabel={tr('family.photo.remove')}
          />
        ) : null}
      </View>
      {note ? <Text style={[styles.hint, { color: t.cinnamon }]}>{note}</Text> : null}
    </View>
  );
}

// ---- Baby profile ----

export interface BabyFormSave {
  id?: string;
  name: string;
  birthDate: string;
  preferredUnits: 'metric' | 'imperial';
  /** A freshly picked photo (picker/cache URI) — the caller copies it into managed storage. */
  pendingPhotoUri?: string;
  /** Explicit removal request on edit. */
  removePhoto?: boolean;
}

export function BabyForm({
  initial,
  onCancel,
  onSave,
  canUsePhotos = true,
}: {
  initial?: Baby;
  onCancel: () => void;
  onSave: (b: BabyFormSave) => void;
  canUsePhotos?: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [units, setUnits] = useState<'metric' | 'imperial'>(initial?.preferredUnits ?? 'metric');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownPhoto = removePhoto ? null : pendingPhotoUri ?? initial?.photoUri ?? null;

  const save = () => {
    if (!name.trim()) {
      setError(tr('form.baby.errName'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError(tr('form.err.birthDate'));
      return;
    }
    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim(),
      birthDate,
      preferredUnits: units,
      ...(pendingPhotoUri ? { pendingPhotoUri } : {}),
      ...(removePhoto && initial?.photoUri ? { removePhoto: true } : {}),
    });
  };

  return (
    <View>
      <SheetHeader
        title={initial ? tr('form.baby.editTitle') : tr('form.baby.newTitle')}
        subtitle={tr('form.baby.subtitle')}
        onCancel={onCancel}
      />
      <Field label={tr('form.baby.name')}>
        <TextInputField label={tr('form.baby.name')} value={name} onChangeText={setName} placeholder="Aru" maxLength={40} />
      </Field>
      <Field label={tr('form.baby.birthDate')} hint={tr('form.baby.birthDateHint')}>
        <TextInputField label={tr('form.baby.birthDate')} value={birthDate} onChangeText={setBirthDate} placeholder="2026-08-14" maxLength={10} keyboardType="number-pad" />
      </Field>
      <Field label={tr('form.baby.units')}>
        <SegmentedControl
          label="Preferred units"
          options={[
            { value: 'metric' as const, label: 'kg · cm' },
            { value: 'imperial' as const, label: 'lb · in' },
          ]}
          value={units}
          onChange={setUnits}
        />
      </Field>
      <Field label={tr('form.photo')}>
        <PhotoSection
          previewUri={shownPhoto}
          canUsePhotos={canUsePhotos}
          previewLabel="Baby photo preview"
          onChange={(uri) => {
            setRemovePhoto(uri === null);
            setPendingPhotoUri(uri);
          }}
        />
      </Field>
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label={initial ? 'Save changes' : 'Create profile'} onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

// ---- Growth ----

export function GrowthForm({
  units,
  onCancel,
  onSave,
}: {
  units: 'metric' | 'imperial';
  onCancel: () => void;
  onSave: (g: Omit<GrowthRecord, 'id' | 'babyId'>) => void;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError(tr('form.err.date'));
      return;
    }
    let weightGrams: number | undefined;
    let heightCm: number | undefined;
    let headCm: number | undefined;
    if (weight.trim()) {
      const n = Number(weight);
      if (Number.isNaN(n) || n <= 0) {
        setError(tr('form.growth.errWeight'));
        return;
      }
      weightGrams = units === 'imperial' ? Math.round(n * 453.592) : Math.round(n * 1000);
      if (weightGrams < 250 || weightGrams > 25000) {
        setError(tr('form.growth.errWeightRange'));
        return;
      }
    }
    if (height.trim()) {
      const n = Number(height);
      if (Number.isNaN(n) || n <= 0) {
        setError(tr('form.growth.errHeight'));
        return;
      }
      heightCm = units === 'imperial' ? Math.round(n * 2.54 * 10) / 10 : Math.round(n * 10) / 10;
      if (heightCm < 20 || heightCm > 200) {
        setError(tr('form.growth.errHeightRange'));
        return;
      }
    }
    if (head.trim()) {
      const n = Number(head);
      if (Number.isNaN(n) || n <= 0) {
        setError(tr('form.growth.errHead'));
        return;
      }
      headCm = units === 'imperial' ? Math.round(n * 2.54 * 10) / 10 : Math.round(n * 10) / 10;
      if (headCm < 20 || headCm > 60) {
        setError(tr('form.growth.errHeadRange'));
        return;
      }
    }
    if (weightGrams === undefined && heightCm === undefined && headCm === undefined) {
      setError(tr('form.growth.errNone'));
      return;
    }
    onSave({
      date,
      weightGrams,
      heightCm,
      headCircumferenceCm: headCm,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <View>
      <SheetHeader
        title={tr('form.growth.title')}
        subtitle={tr('form.growth.subtitle')}
        onCancel={onCancel}
      />
      <Field label="Date" hint={tr('form.hint.date')}>
        <TextInputField label={tr('form.date')} value={date} onChangeText={setDate} maxLength={10} keyboardType="number-pad" />
      </Field>
      <Field label={units === 'imperial' ? 'Weight (lb)' : 'Weight (kg)'}>
        <TextInputField label={tr('form.growth.weight')} value={weight} onChangeText={setWeight} placeholder={units === 'imperial' ? '9.5' : '4.3'} keyboardType="decimal-pad" maxLength={7} />
      </Field>
      <Field label={units === 'imperial' ? 'Length / height (in)' : 'Length / height (cm)'}>
        <TextInputField label={tr('form.growth.height')} value={height} onChangeText={setHeight} placeholder={units === 'imperial' ? '22.4' : '57'} keyboardType="decimal-pad" maxLength={7} />
      </Field>
      <Field label={units === 'imperial' ? 'Head circumference (in)' : 'Head circumference (cm)'}>
        <TextInputField label={tr('form.growth.head')} value={head} onChangeText={setHead} placeholder={units === 'imperial' ? '15.7' : '40'} keyboardType="decimal-pad" maxLength={7} />
      </Field>
      <Field label={tr('form.noteOptional')}>
        <TextInputField label={tr('form.growth.note')} value={note} onChangeText={setNote} maxLength={500} multiline />
      </Field>
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label={tr('form.growth.save')} onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

// ---- Milestones ----

const MILESTONE_CATEGORIES: { value: MilestoneCategory; label: string }[] = [
  { value: 'motor', label: 'Motor' },
  { value: 'social', label: 'Social' },
  { value: 'language', label: 'Language' },
  { value: 'cognitive', label: 'Thinking' },
  { value: 'feeding', label: 'Feeding' },
  { value: 'custom', label: 'Custom' },
];

export function MilestoneForm({
  initial,
  onCancel,
  onSave,
  canUsePhotos = true,
}: {
  initial?: MilestoneRecord;
  onCancel: () => void;
  onSave: (m: Omit<MilestoneRecord, 'id' | 'babyId'> & {
    pendingPhotoUri?: string;
    removePhoto?: boolean;
    id?: string;
  }) => void;
  canUsePhotos?: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<MilestoneCategory>(initial?.category ?? 'motor');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(initial?.note ?? '');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownPhoto = removePhoto ? null : pendingPhotoUri ?? initial?.photoUri ?? null;

  const save = () => {
    if (!title.trim()) {
      setError(tr('form.milestone.errTitle'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError(tr('form.err.date'));
      return;
    }
    onSave({
      ...(initial ? { id: initial.id } : {}),
      title: title.trim(),
      category,
      date,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(pendingPhotoUri ? { pendingPhotoUri } : {}),
      ...(removePhoto && initial?.photoUri ? { removePhoto: true } : {}),
    });
  };

  return (
    <View>
      <SheetHeader title={initial ? tr('form.milestone.editTitle') : tr('form.milestone.newTitle')} subtitle={tr('form.milestone.subtitle')} onCancel={onCancel} />
      <Field label={tr('form.milestone.what')}>
        <TextInputField label={tr('form.milestone.label')} value={title} onChangeText={setTitle} placeholder="First laugh" maxLength={120} />
      </Field>
      <Field label={tr('form.category')}>
        <SegmentedControl label={tr('form.category')} options={MILESTONE_CATEGORIES.filter((c) => c.value !== 'custom' && c.value !== 'feeding').map((c) => ({ value: c.value, label: tr(`form.cat.${c.value}`) })).concat([{ value: 'feeding' as const, label: tr('form.cat.feeding') }]).slice(0, 5)} value={category} onChange={setCategory} />
      </Field>
      <Field label={tr('form.date')} hint={tr('form.hint.dateEditable')}>
        <TextInputField label={tr('form.date')} value={date} onChangeText={setDate} maxLength={10} keyboardType="number-pad" />
      </Field>
      <Field label={tr('form.noteOptional')}>
        <TextInputField label={tr('form.milestone.note')} value={note} onChangeText={setNote} maxLength={500} multiline />
      </Field>
      <Field label={tr('form.photoOptional')}>
        <PhotoSection
          previewUri={shownPhoto}
          canUsePhotos={canUsePhotos}
          previewLabel="Milestone photo preview"
          onChange={(uri) => {
            setRemovePhoto(uri === null);
            setPendingPhotoUri(uri);
          }}
        />
      </Field>
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label={initial ? tr('form.saveChanges') : tr('form.milestone.save')} onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

// ---- Medications ----

export function MedicationForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (m: Omit<MedicationRecord, 'id' | 'babyId'>) => void;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState<'ml' | 'mg' | 'drops' | 'tablets'>('ml');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setError(tr('form.med.errName'));
      return;
    }
    let doseAmount: number | undefined;
    if (dose.trim()) {
      const n = Number(dose);
      if (Number.isNaN(n) || n < 0 || n > 1000) {
        setError(tr('form.med.errDose'));
        return;
      }
      doseAmount = n;
    }
    onSave({
      name: name.trim(),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      ...(doseAmount !== undefined ? { doseAmount, doseUnit: unit } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <View>
      <SheetHeader
        title={tr('form.med.title')}
        subtitle={tr('form.med.subtitle')}
        onCancel={onCancel}
      />
      <Field label={tr('form.baby.name')}>
        <TextInputField label="Medication name" value={name} onChangeText={setName} placeholder="Vitamin D drops" maxLength={80} />
      </Field>
      <Field label={tr('form.med.instructionsPrescribed')}>
        <TextInputField label="Instructions" value={instructions} onChangeText={setInstructions} placeholder="1 drop daily after feeding" maxLength={500} multiline />
      </Field>
      <Field label={tr('form.med.doseOptional')}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextInputField label="Dose amount" value={dose} onChangeText={setDose} placeholder="0.5" keyboardType="decimal-pad" maxLength={7} />
          </View>
          <View style={{ width: 130 }}>
            <SegmentedControl
              label="Dose unit"
              options={[
                { value: 'ml' as const, label: 'mL' },
                { value: 'mg' as const, label: 'mg' },
                { value: 'drops' as const, label: 'drops' },
                { value: 'tablets' as const, label: 'tabs' },
              ]}
              value={unit}
              onChange={setUnit}
            />
          </View>
        </View>
      </Field>
      <Field label={tr('form.notesOptional')}>
        <TextInputField label="Medication notes" value={notes} onChangeText={setNotes} maxLength={500} multiline />
      </Field>
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label={tr('form.med.save')} onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

// ---- Vaccinations ----

export function VaccinationForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (v: Omit<VaccinationRecord, 'id' | 'babyId'>) => void;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [name, setName] = useState('');
  const [dateGiven, setDateGiven] = useState(new Date().toISOString().slice(0, 10));
  const [nextAppointment, setNextAppointment] = useState('');
  const [provider, setProvider] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setError(tr('form.vax.errName'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateGiven)) {
      setError(tr('form.vax.errDateGiven'));
      return;
    }
    if (nextAppointment.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(nextAppointment.trim())) {
      setError(tr('form.vax.errNext'));
      return;
    }
    onSave({
      name: name.trim(),
      dateGiven,
      ...(nextAppointment.trim() ? { nextAppointment: nextAppointment.trim() } : {}),
      ...(provider.trim() ? { provider: provider.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <View>
      <SheetHeader
        title={tr('form.vax.title')}
        subtitle="Record what was given. The app does not advise on schedules."
        onCancel={onCancel}
      />
      <Field label={tr('form.vax.name')}>
        <TextInputField label="Vaccine name" value={name} onChangeText={setName} placeholder="Hepatitis B" maxLength={120} />
      </Field>
      <Field label="Date given" hint={tr('form.hint.date')}>
        <TextInputField label="Date given" value={dateGiven} onChangeText={setDateGiven} maxLength={10} keyboardType="number-pad" />
      </Field>
      <Field label="Next appointment (optional)" hint={tr('form.hint.date')}>
        <TextInputField label="Next appointment" value={nextAppointment} onChangeText={setNextAppointment} maxLength={10} keyboardType="number-pad" />
      </Field>
      <Field label={tr('form.vax.providerOptional')}>
        <TextInputField label="Provider" value={provider} onChangeText={setProvider} placeholder="Clinic name" maxLength={120} />
      </Field>
      <Field label={tr('form.notesOptional')}>
        <TextInputField label="Vaccination notes" value={notes} onChangeText={setNotes} maxLength={500} multiline />
      </Field>
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label={tr('form.vax.save')} onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

// ---- Routines ----

const ROUTINE_KINDS: { value: RoutineKind; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'nap', label: 'Nap' },
  { value: 'pump', label: 'Pump' },
  { value: 'tummy_time', label: 'Tummy' },
  { value: 'reminder', label: 'Reminder' },
];

export function RoutineForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (r: Omit<RoutineTemplate, 'id' | 'babyId'>) => void;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<RoutineKind>('feed');
  const [timeOfDay, setTimeOfDay] = useState('07:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const save = () => {
    if (!title.trim()) {
      setError(tr('form.routine.errName'));
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay.trim())) {
      setError(tr('form.routine.errTime'));
      return;
    }
    if (days.length === 0) {
      setError(tr('form.routine.errDays'));
      return;
    }
    onSave({
      title: title.trim(),
      kind,
      timeOfDay: timeOfDay.trim(),
      days,
      active: true,
    });
  };

  return (
    <View>
      <SheetHeader
        title="Daily routine"
        subtitle={tr('form.routine.subtitle')}
        onCancel={onCancel}
      />
      <Field label={tr('form.baby.name')}>
        <TextInputField label="Routine name" value={title} onChangeText={setTitle} placeholder="Morning feed" maxLength={80} />
      </Field>
      <Field label={tr('form.vax.type')}>
        <SegmentedControl label="Type" options={ROUTINE_KINDS} value={kind} onChange={setKind} />
      </Field>
      <Field label="Time of day" hint={tr('form.routine.timeHint')}>
        <TextInputField label="Time of day" value={timeOfDay} onChangeText={setTimeOfDay} maxLength={5} keyboardType="number-pad" />
      </Field>
      <Field label={tr('form.routine.days')}>
        <View style={styles.daysRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, idx) => {
            const on = days.includes(idx);
            return (
              <Pressable
                key={idx}
                onPress={() => toggleDay(idx)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx]}${on ? ' selected' : ''}`}
                style={[styles.dayChip, { backgroundColor: on ? t.accent : t.surfaceAlt, borderColor: t.hairline }]}
              >
                <Text style={[styles.dayChipText, { color: on ? t.accentInk : t.inkMuted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
      {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
      <PrimaryButton label={tr('form.routine.save')} onPress={save} style={{ marginTop: spacing(3), minHeight: 52 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    marginBottom: spacing(2),
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  photoButtons: { gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2, lineHeight: 18 },
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
  hint: {
    fontSize: 12,
    marginTop: spacing(1),
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: 'top',
    paddingVertical: spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
  },
  daysRow: {
    flexDirection: 'row',
    gap: spacing(1),
  },
  dayChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: { fontSize: 13, fontWeight: '700' },
  error: {
    marginTop: spacing(2),
    fontSize: 14,
  },
});
