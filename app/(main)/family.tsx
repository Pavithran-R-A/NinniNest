import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Baby as BabyIcon,
  Plus,
  Ruler,
  Star,
  Pill,
  Syringe,
  Repeat,
  Trash2,
  Pencil,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import { babyAge, formatClock, localDateKey } from '@/src/models/time';
import { formatWeight, formatLength, buildTrend, describeTrend, ageInDays } from '@/src/models/growth';
import { routinesDueToday } from '@/src/models/routines';
import type {
  Baby, GrowthRecord, MilestoneRecord, RoutineTemplate, VaccinationRecord,
} from '@/src/models/types';
import { EmptyState } from '@/src/components/ui';
import {
  BabyForm, GrowthForm, MilestoneForm, MedicationForm, VaccinationForm, RoutineForm,
} from '@/src/screens/FamilyForms';
import { confirmDialog } from '@/src/models/confirm';
import { persistRecordWithPhoto, type PhotoWorkflowIo } from '@/src/models/photoPersist';
import { importPhoto, deletePhotoIfInManagedDir } from '@/src/models/media';
import { useI18n } from '@/src/i18n/useI18n';

type FamilyTab = 'profiles' | 'growth' | 'milestones' | 'health' | 'routines';

const TABS: { key: FamilyTab; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'profiles', labelKey: 'family.tab.profiles', icon: <BabyIcon size={16} strokeWidth={2} /> },
  { key: 'growth', labelKey: 'family.tab.growth', icon: <Ruler size={16} strokeWidth={2} /> },
  { key: 'milestones', labelKey: 'family.tab.milestones', icon: <Star size={16} strokeWidth={2} /> },
  { key: 'health', labelKey: 'family.tab.health', icon: <Pill size={16} strokeWidth={2} /> },
  { key: 'routines', labelKey: 'family.tab.routines', icon: <Repeat size={16} strokeWidth={2} /> },
];

export default function FamilyScreen() {
  const t = useTheme();
  const {
    currentBaby, data, isDemo, addBaby, updateBaby, deleteBaby,
    addGrowthRecord, deleteGrowthRecord,
    addMilestone, deleteMilestone,
    addMedication, deleteMedication,
    addMedicationAdministration, deleteMedicationAdministration,
    addVaccination, deleteVaccination,
    addRoutine, deleteRoutine,
    setActiveBaby,
  } = useApp();
  const { t: tr } = useI18n();

  const [tab, setTab] = useState<FamilyTab>('profiles');
  const [sheet, setSheet] = useState<string | null>(null);
  const [editingBaby, setEditingBaby] = useState<Baby | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const closeSheet = () => {
    setSheet(null);
    setEditingBaby(null);
    setSaveError(null);
  };

  // Photo durability io: copies into the managed media area (native) and only
  // ever deletes files the operation itself created. Web is records-only.
  const photoIo: PhotoWorkflowIo = {
    importPhoto: (src, babyId) => importPhoto(src, babyId),
    deleteManagedPhoto: (uri) => deletePhotoIfInManagedDir(uri),
  };

  /** Runs the photo-aware save; keeps the sheet open with a message on failure. */
  const runPhotoSave = async (
    outcome: { ok: boolean; error?: 'copy-failed' | 'save-failed' },
    onSuccess: () => void
  ) => {
    if (outcome.ok) {
      setSaveError(null);
      onSuccess();
    } else {
      setSaveError(tr(outcome.error === 'copy-failed' ? 'family.copyFailed' : 'family.saveFailed'));
    }
  };

  const personalBabies = useMemo(() => data.babies.filter((b) => !b.isDemo), [data.babies]);
  const units = currentBaby?.preferredUnits ?? 'metric';

  const babyGrowth = useMemo(
    () => data.growthRecords.filter((g) => g.babyId === currentBaby?.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.growthRecords, currentBaby]
  );
  const babyMilestones = useMemo(
    () => data.milestones.filter((m) => m.babyId === currentBaby?.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.milestones, currentBaby]
  );
  const babyMeds = useMemo(
    () => data.medications.filter((m) => m.babyId === currentBaby?.id),
    [data.medications, currentBaby]
  );
  const babyVax = useMemo(
    () => data.vaccinations.filter((v) => v.babyId === currentBaby?.id).sort((a, b) => (a.dateGiven < b.dateGiven ? 1 : -1)),
    [data.vaccinations, currentBaby]
  );
  const babyRoutines = useMemo(
    () => data.routines.filter((r) => r.babyId === currentBaby?.id).sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay)),
    [data.routines, currentBaby]
  );
  const dueRoutines = useMemo(() => routinesDueToday(babyRoutines), [babyRoutines]);

  const showBabyPicker = tab !== 'profiles';

  const confirmDeleteBaby = (baby: Baby) => {
    confirmDialog(
      'Delete this profile?',
      `${baby.name} and every recorded event, timer, measurement, milestone, medication and vaccination for them will be permanently erased.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete profile',
          style: 'destructive',
          onPress: () => void deleteBaby(baby.id),
        },
      ]
    );
  };

  const confirmDelete = (what: string, run: () => void) => {
    confirmDialog(`Remove this ${what}?`, 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: run },
    ]);
  };

  const weightTrend = useMemo(
    () => (currentBaby ? buildTrend(babyGrowth, (g) => g.weightGrams, currentBaby.birthDate) : []),
    [babyGrowth, currentBaby]
  );
  const heightTrend = useMemo(
    () => (currentBaby ? buildTrend(babyGrowth, (g) => g.heightCm, currentBaby.birthDate) : []),
    [babyGrowth, currentBaby]
  );

  if (!isDemo && personalBabies.length === 0) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>{tr('family.title')}</Text>
        </View>
        <EmptyState
          title={tr('family.noBaby.title')}
          body={tr('family.noBaby.body')}
        />
        <View style={styles.centerBtnWrap}>
          <Pressable
            onPress={() => {
              setEditingBaby(null);
              setSheet('baby');
            }}
            accessibilityRole="button"
            accessibilityLabel="Create first profile"
            style={[styles.bigBtn, { backgroundColor: t.accent }]}
          >
            <Plus size={22} color={t.accentInk} strokeWidth={2.5} />
            <Text style={[styles.bigBtnText, { color: t.accentInk }]}>Create first profile</Text>
          </Pressable>
        </View>
        <Modal visible={sheet === 'baby'} animationType="slide" transparent onRequestClose={closeSheet}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
            <View style={[styles.sheet, { backgroundColor: t.canvas }]}>
              {saveError ? <Text style={{ color: t.cinnamon, marginBottom: 12 }}>{saveError}</Text> : null}
              <BabyForm
                canUsePhotos={!isDemo}
                onCancel={closeSheet}
                onSave={async (b) => {
                  const baby: Baby = {
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                    name: b.name,
                    birthDate: b.birthDate,
                    preferredUnits: b.preferredUnits,
                  };
                  runPhotoSave(
                    await persistRecordWithPhoto(
                      photoIo,
                      { record: baby, babyId: baby.id, pendingPhotoUri: b.pendingPhotoUri, isNew: true },
                      (rec) => addBaby(rec)
                    ),
                    () => setSheet(null)
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.canvas }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>{tr('family.title')}</Text>
        {showBabyPicker && currentBaby ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.babyPicker} style={{ marginTop: spacing(2) }}>
            {personalBabies.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => setActiveBaby(b.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: b.id === currentBaby.id }}
                style={[
                  styles.babyChip,
                  { backgroundColor: b.id === currentBaby.id ? t.accent : t.surfaceAlt, borderColor: t.hairline },
                ]}
              >
                <Text style={[styles.babyChipText, { color: b.id === currentBaby.id ? t.accentInk : t.ink }]}>
                  {b.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={[styles.tabRow, { borderBottomColor: t.hairline }]}>
        {TABS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            style={[styles.tabBtn, tab === item.key && { borderBottomColor: t.accent, borderBottomWidth: 2 }]}
          >
            <View style={{ opacity: tab === item.key ? 1 : 0.6 }}>
              {React.cloneElement(item.icon as React.ReactElement<{ color?: string }>, {
                color: tab === item.key ? t.accent : t.inkMuted,
              })}
            </View>
            <Text style={[styles.tabText, { color: tab === item.key ? t.accent : t.inkMuted }]}>{tr(item.labelKey)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'profiles' && (
          <ProfilesPanel
            babies={personalBabies}
            currentBaby={currentBaby}
            isDemo={isDemo}
            data={data}
            onNew={() => {
              setEditingBaby(null);
              setSheet('baby');
            }}
            onEdit={(b) => {
              setEditingBaby(b);
              setSheet('baby');
            }}
            onDelete={confirmDeleteBaby}
            onSwitch={setActiveBaby}
          />
        )}

        {tab === 'growth' && currentBaby && (
          <GrowthPanel
            records={babyGrowth}
            units={units}
            birthDate={currentBaby.birthDate}
            weightTrend={weightTrend}
            heightTrend={heightTrend}
            onNew={() => setSheet('growth')}
            onDelete={(id) => confirmDelete('measurement', () => deleteGrowthRecord(id))}
          />
        )}

        {tab === 'milestones' && (
          <MilestonesPanel
            records={babyMilestones}
            onNew={() => setSheet('milestone')}
            onDelete={(id) => confirmDelete('milestone', () => deleteMilestone(id))}
          />
        )}

        {tab === 'health' && (
          <HealthPanel
            meds={babyMeds}
            administrations={data.medicationAdministrations.filter((a) => a.babyId === currentBaby?.id)}
            vaccinations={babyVax}
            onNewMed={() => setSheet('med')}
            onNewVax={() => setSheet('vax')}
            onAdminister={(medId) => {
              addMedicationAdministration({
                id: crypto.randomUUID(),
                babyId: currentBaby?.id ?? '',
                medicationId: medId,
                timestamp: new Date().toISOString(),
                ...(isDemo ? { isDemo: true } : {}),
              });
            }}
            onDeleteMed={(id) => confirmDelete('medication', () => deleteMedication(id))}
            onDeleteAdmin={(id) => confirmDelete('recorded dose', () => deleteMedicationAdministration(id))}
            onDeleteVax={(id) => confirmDelete('vaccination', () => deleteVaccination(id))}
          />
        )}

        {tab === 'routines' && (
          <RoutinesPanel
            routines={babyRoutines}
            dueToday={dueRoutines.map((r) => r.id)}
            onNew={() => setSheet('routine')}
            onDelete={(id) => confirmDelete('routine', () => deleteRoutine(id))}
          />
        )}
      </ScrollView>

      <Modal visible={sheet !== null} animationType="slide" transparent onRequestClose={closeSheet}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <View style={[styles.sheet, { backgroundColor: t.canvas }]}>
            {saveError ? <Text style={{ color: t.cinnamon, marginBottom: 12 }}>{saveError}</Text> : null}
            {sheet === 'baby' && (
              <BabyForm
                initial={editingBaby ?? undefined}
                canUsePhotos={!isDemo}
                onCancel={closeSheet}
                onSave={async (b) => {
                  if (b.id && editingBaby) {
                    const baby: Baby = {
                      ...editingBaby,
                      name: b.name,
                      birthDate: b.birthDate,
                      preferredUnits: b.preferredUnits,
                    };
                    runPhotoSave(
                      await persistRecordWithPhoto(
                        photoIo,
                        {
                          record: baby,
                          babyId: baby.id,
                          pendingPhotoUri: b.pendingPhotoUri,
                          removePhoto: b.removePhoto,
                          previousPhotoUri: editingBaby.photoUri,
                          isNew: false,
                        },
                        (rec) => updateBaby(rec)
                      ),
                      () => closeSheet()
                    );
                  } else {
                    const baby: Baby = {
                      id: crypto.randomUUID(),
                      createdAt: new Date().toISOString(),
                      name: b.name,
                      birthDate: b.birthDate,
                      preferredUnits: b.preferredUnits,
                    };
                    runPhotoSave(
                      await persistRecordWithPhoto(
                        photoIo,
                        { record: baby, babyId: baby.id, pendingPhotoUri: b.pendingPhotoUri, isNew: true },
                        (rec) => addBaby(rec)
                      ),
                      () => closeSheet()
                    );
                  }
                }}
              />
            )}
            {sheet === 'growth' && currentBaby && (
              <GrowthForm
                units={units}
                onCancel={closeSheet}
                onSave={(g) => {
                  addGrowthRecord({
                    ...g,
                    id: crypto.randomUUID(),
                    babyId: currentBaby.id,
                    ...(isDemo ? { isDemo: true } : {}),
                  });
                  setSheet(null);
                }}
              />
            )}
            {sheet === 'milestone' && currentBaby && (
              <MilestoneForm
                canUsePhotos={!isDemo}
                onCancel={closeSheet}
                onSave={async (m) => {
                  const { pendingPhotoUri: _pending, ...fields } = m;
                  const milestone: MilestoneRecord = {
                    ...fields,
                    id: crypto.randomUUID(),
                    babyId: currentBaby.id,
                    ...(isDemo ? { isDemo: true } : {}),
                  };
                  runPhotoSave(
                    await persistRecordWithPhoto(
                      photoIo,
                      {
                        record: milestone,
                        babyId: currentBaby.id,
                        pendingPhotoUri: _pending,
                        isNew: true,
                      },
                      (rec) => addMilestone(rec)
                    ),
                    () => closeSheet()
                  );
                }}
              />
            )}
            {sheet === 'med' && currentBaby && (
              <MedicationForm
                onCancel={closeSheet}
                onSave={(m) => {
                  addMedication({
                    ...m,
                    id: crypto.randomUUID(),
                    babyId: currentBaby.id,
                    ...(isDemo ? { isDemo: true } : {}),
                  });
                  setSheet(null);
                }}
              />
            )}
            {sheet === 'vax' && currentBaby && (
              <VaccinationForm
                onCancel={closeSheet}
                onSave={(v) => {
                  addVaccination({
                    ...v,
                    id: crypto.randomUUID(),
                    babyId: currentBaby.id,
                    ...(isDemo ? { isDemo: true } : {}),
                  });
                  setSheet(null);
                }}
              />
            )}
            {sheet === 'routine' && currentBaby && (
              <RoutineForm
                onCancel={closeSheet}
                onSave={(r) => {
                  addRoutine({
                    ...r,
                    id: crypto.randomUUID(),
                    babyId: currentBaby.id,
                    ...(isDemo ? { isDemo: true } : {}),
                  });
                  setSheet(null);
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProfilesPanel({
  babies, currentBaby, isDemo, data, onNew, onEdit, onDelete, onSwitch,
}: {
  babies: Baby[];
  currentBaby: Baby | null;
  isDemo: boolean;
  data: ReturnType<typeof useApp>['data'];
  onNew: () => void;
  onEdit: (b: Baby) => void;
  onDelete: (b: Baby) => void;
  onSwitch: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View>
      {babies.map((b) => {
        const eventCount = data.events.filter((e) => e.babyId === b.id).length;
        const activeTimers = data.activeTimers.filter((tm) => tm.babyId === b.id).length;
        const selected = currentBaby?.id === b.id;
        return (
          <View key={b.id} style={[styles.card, { backgroundColor: t.surface, borderColor: selected ? t.accent : t.hairline }]}>
            <Pressable onPress={() => onSwitch(b.id)} accessibilityRole="button" accessibilityLabel={`Switch to ${b.name}`}>
              <View style={styles.cardTopRow}>
                <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
                  <BabyIcon size={22} color={t.accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: t.ink }]}>
                    {b.name}
                    {selected ? ' · viewing' : ''}
                  </Text>
                  <Text style={[styles.cardDetail, { color: t.inkMuted }]}>
                    {babyAge(b.birthDate)} · {eventCount} events
                    {activeTimers > 0 ? ` · ${activeTimers} timer${activeTimers === 1 ? '' : 's'} running` : ''}
                  </Text>
                </View>
                {selected ? <Check size={18} color={t.accent} strokeWidth={2.5} /> : <ChevronRight size={18} color={t.inkFaint} strokeWidth={2} />}
              </View>
            </Pressable>
            {!isDemo ? (
              <View style={[styles.cardActions, { borderTopColor: t.hairline }]}>
                <Pressable onPress={() => onEdit(b)} accessibilityRole="button" accessibilityLabel={`Edit ${b.name}`} style={styles.cardAction}>
                  <Pencil size={16} color={t.inkMuted} strokeWidth={2} />
                  <Text style={[styles.cardActionText, { color: t.inkMuted }]}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(b)} accessibilityRole="button" accessibilityLabel={`Delete ${b.name}`} style={styles.cardAction}>
                  <Trash2 size={16} color={t.cinnamon} strokeWidth={2} />
                  <Text style={[styles.cardActionText, { color: t.cinnamon }]}>Delete</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      {!isDemo ? (
        <Pressable onPress={onNew} accessibilityRole="button" accessibilityLabel="Add another profile" style={[styles.addCard, { borderColor: t.hairline, backgroundColor: t.surfaceAlt }]}>
          <Plus size={20} color={t.accent} strokeWidth={2.5} />
          <Text style={[styles.addCardText, { color: t.accent }]}>Add another child</Text>
        </Pressable>
      ) : null}
      {isDemo ? (
        <Text style={[styles.demoNote, { color: t.inkMuted }]}>
          Demo mode shows a single synthetic profile. Exit demo in Settings to manage your own family.
        </Text>
      ) : null}
    </View>
  );
}

function GrowthPanel({
  records, units, birthDate, weightTrend, heightTrend, onNew, onDelete,
}: {
  records: GrowthRecord[];
  units: 'metric' | 'imperial';
  birthDate: string;
  weightTrend: ReturnType<typeof buildTrend>;
  heightTrend: ReturnType<typeof buildTrend>;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const t = useTheme();
  const latest = records[0];
  return (
    <View>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.panelHeading, { color: t.ink }]}>Trends</Text>
        <Text style={[styles.trendLine, { color: t.inkMuted }]}>Weight: {describeTrend(weightTrend)}</Text>
        <Text style={[styles.trendLine, { color: t.inkMuted }]}>Height: {describeTrend(heightTrend)}</Text>
        <Text style={[styles.trendNote, { color: t.inkFaint }]}>
          Percentile reference curves are not implemented — this app shows plain descriptive changes only.
        </Text>
      </View>

      {latest ? (
        <View style={[styles.card, { backgroundColor: t.accentSoft, borderColor: t.hairline }]}>
          <Text style={[styles.panelHeading, { color: t.ink }]}>Most recent</Text>
          <Text style={[styles.latestLine, { color: t.ink }]}>
            {latest.date} · {ageInDays(birthDate, latest.date)} days old
          </Text>
          <Text style={[styles.latestValues, { color: t.ink }]}>
            {[
              latest.weightGrams !== undefined ? formatWeight(latest.weightGrams, units) : null,
              latest.heightCm !== undefined ? formatLength(latest.heightCm, units) : null,
              latest.headCircumferenceCm !== undefined ? formatLength(latest.headCircumferenceCm, units) : null,
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={onNew} accessibilityRole="button" accessibilityLabel="Add growth measurement" style={[styles.addCard, { borderColor: t.hairline, backgroundColor: t.surfaceAlt }]}>
        <Plus size={20} color={t.accent} strokeWidth={2.5} />
        <Text style={[styles.addCardText, { color: t.accent }]}>Add measurement</Text>
      </Pressable>

      {records.length === 0 ? (
        <EmptyState title="No measurements yet" body="Record weight, length and head circumference to see them as gentle trends over time." />
      ) : (
        records.map((g) => (
          <View key={g.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: t.ink }]}>
                  {g.date} · {ageInDays(birthDate, g.date)}d old
                </Text>
                <Text style={[styles.cardDetail, { color: t.inkMuted }]}>
                  {[
                    g.weightGrams !== undefined ? formatWeight(g.weightGrams, units) : null,
                    g.heightCm !== undefined ? formatLength(g.heightCm, units) : null,
                    g.headCircumferenceCm !== undefined ? formatLength(g.headCircumferenceCm, units) : null,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                  {g.note ? ` — ${g.note}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => onDelete(g.id)} accessibilityRole="button" accessibilityLabel="Delete measurement" style={styles.iconBtn}>
                <Trash2 size={16} color={t.cinnamon} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function MilestonesPanel({
  records, onNew, onDelete,
}: {
  records: MilestoneRecord[];
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const t = useTheme();
  const sections = useMemo(() => {
    const byYear = new Map<string, MilestoneRecord[]>();
    for (const m of records) {
      const y = m.date.slice(0, 4);
      const arr = byYear.get(y) ?? [];
      arr.push(m);
      byYear.set(y, arr);
    }
    return Array.from(byYear.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([year, items]) => ({ title: year, data: items }));
  }, [records]);

  return (
    <View>
      <Pressable onPress={onNew} accessibilityRole="button" accessibilityLabel="Add milestone" style={[styles.addCard, { borderColor: t.hairline, backgroundColor: t.surfaceAlt }]}>
        <Plus size={20} color={t.accent} strokeWidth={2.5} />
        <Text style={[styles.addCardText, { color: t.accent }]}>Add milestone or memory</Text>
      </Pressable>
      {records.length === 0 ? (
        <EmptyState title="No milestones yet" body="First smiles, first steps, first foods — build a chronological memory journal here." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.yearHeader, { color: t.cinnamon }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
                  <Star size={18} color={t.accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: t.ink }]}>{item.title}</Text>
                  <Text style={[styles.cardDetail, { color: t.inkMuted }]}>
                    {item.date} · {item.category}
                    {item.note ? ` — ${item.note}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => onDelete(item.id)} accessibilityRole="button" accessibilityLabel="Delete milestone" style={styles.iconBtn}>
                  <Trash2 size={16} color={t.cinnamon} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function HealthPanel({
  meds, administrations, vaccinations, onNewMed, onNewVax, onAdminister, onDeleteMed, onDeleteAdmin, onDeleteVax,
}: {
  meds: ReturnType<typeof useApp>['data']['medications'];
  administrations: ReturnType<typeof useApp>['data']['medicationAdministrations'];
  vaccinations: VaccinationRecord[];
  onNewMed: () => void;
  onNewVax: () => void;
  onAdminister: (medId: string) => void;
  onDeleteMed: (id: string) => void;
  onDeleteAdmin: (id: string) => void;
  onDeleteVax: (id: string) => void;
}) {
  const t = useTheme();
  const todayKey = localDateKey(new Date());
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: t.ink }]}>Medications</Text>
      <Pressable onPress={onNewMed} accessibilityRole="button" accessibilityLabel="Add medication" style={[styles.addCard, { borderColor: t.hairline, backgroundColor: t.surfaceAlt }]}>
        <Plus size={20} color={t.accent} strokeWidth={2.5} />
        <Text style={[styles.addCardText, { color: t.accent }]}>Add medication</Text>
      </Pressable>
      {meds.length === 0 ? (
        <Text style={[styles.emptyInline, { color: t.inkMuted }]}>No medications recorded. You enter the name and dose yourself — the app only keeps the record.</Text>
      ) : (
        meds.map((m) => {
          const todayDoses = administrations.filter(
            (a) => a.medicationId === m.id && localDateKey(new Date(a.timestamp)) === todayKey
          );
          return (
            <View key={m.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
                  <Pill size={18} color={t.accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: t.ink }]}>{m.name}</Text>
                  <Text style={[styles.cardDetail, { color: t.inkMuted }]}>
                    {[
                      m.doseAmount !== undefined ? `${m.doseAmount} ${m.doseUnit ?? ''}`.trim() : null,
                      m.instructions,
                    ]
                      .filter(Boolean)
                      .join(' — ')}
                  </Text>
                  {todayDoses.length > 0 ? (
                    <Text style={[styles.doseLine, { color: t.accent }]}>
                      Given today: {todayDoses.map((a) => formatClock(a.timestamp)).join(', ')}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={[styles.cardActions, { borderTopColor: t.hairline }]}>
                <Pressable
                  onPress={() => onAdminister(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark ${m.name} as given now`}
                  style={styles.cardAction}
                >
                  <Check size={16} color={t.accent} strokeWidth={2.5} />
                  <Text style={[styles.cardActionText, { color: t.accent }]}>Given now</Text>
                </Pressable>
                <Pressable onPress={() => onDeleteMed(m.id)} accessibilityRole="button" accessibilityLabel={`Delete ${m.name}`} style={styles.cardAction}>
                  <Trash2 size={16} color={t.cinnamon} strokeWidth={2} />
                  <Text style={[styles.cardActionText, { color: t.cinnamon }]}>Delete</Text>
                </Pressable>
              </View>
              {administrations
                .filter((a) => a.medicationId === m.id)
                .slice()
                .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
                .slice(0, 5)
                .map((a) => (
                  <View key={a.id} style={[styles.adminRow, { borderTopColor: t.hairline }]}>
                    <Text style={[styles.adminText, { color: t.inkMuted }]}>
                      {new Date(a.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                      {formatClock(a.timestamp)}
                      {a.doseAmount !== undefined ? ` · ${a.doseAmount} ${a.doseUnit ?? ''}`.trim() : ''}
                    </Text>
                    <Pressable onPress={() => onDeleteAdmin(a.id)} accessibilityRole="button" accessibilityLabel="Remove this recorded dose" style={styles.iconBtn}>
                      <X size={14} color={t.inkFaint} strokeWidth={2} />
                    </Pressable>
                  </View>
                ))}
            </View>
          );
        })
      )}

      <Text style={[styles.sectionTitle, { color: t.ink, marginTop: spacing(5) }]}>Vaccinations</Text>
      <Pressable onPress={onNewVax} accessibilityRole="button" accessibilityLabel="Add vaccination" style={[styles.addCard, { borderColor: t.hairline, backgroundColor: t.surfaceAlt }]}>
        <Syringe size={20} color={t.accent} strokeWidth={2} />
        <Text style={[styles.addCardText, { color: t.accent }]}>Add vaccination record</Text>
      </Pressable>
      {vaccinations.length === 0 ? (
        <Text style={[styles.emptyInline, { color: t.inkMuted }]}>No vaccinations recorded. This is a personal record only — the app does not advise on schedules.</Text>
      ) : (
        vaccinations.map((v) => (
          <View key={v.id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: t.ink }]}>{v.name}</Text>
                <Text style={[styles.cardDetail, { color: t.inkMuted }]}>
                  {[
                    `Given ${v.dateGiven}`,
                    v.nextAppointment ? `Next: ${v.nextAppointment}` : null,
                    v.provider,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {v.notes ? ` — ${v.notes}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => onDeleteVax(v.id)} accessibilityRole="button" accessibilityLabel="Delete vaccination" style={styles.iconBtn}>
                <Trash2 size={16} color={t.cinnamon} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function RoutinesPanel({
  routines, dueToday, onNew, onDelete,
}: {
  routines: RoutineTemplate[];
  dueToday: string[];
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View>
      <Pressable onPress={onNew} accessibilityRole="button" accessibilityLabel="Add routine" style={[styles.addCard, { borderColor: t.hairline, backgroundColor: t.surfaceAlt }]}>
        <Plus size={20} color={t.accent} strokeWidth={2.5} />
        <Text style={[styles.addCardText, { color: t.accent }]}>Add routine</Text>
      </Pressable>
      {routines.length === 0 ? (
        <EmptyState title="No routines yet" body="Repeating templates for feeds, naps, pumping and tummy time. They remind you — they never write journal entries." />
      ) : (
        routines.map((r) => (
          <View key={r.id} style={[styles.card, { backgroundColor: t.surface, borderColor: dueToday.includes(r.id) ? t.accent : t.hairline }]}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: t.ink }]}>
                  {r.timeOfDay} · {r.title}
                </Text>
                <Text style={[styles.cardDetail, { color: t.inkMuted }]}>
                  {r.kind} · {r.active ? 'active' : 'paused'}
                </Text>
              </View>
              <Pressable onPress={() => onDelete(r.id)} accessibilityRole="button" accessibilityLabel="Delete routine" style={styles.iconBtn}>
                <Trash2 size={16} color={t.cinnamon} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ))
      )}
      <Text style={[styles.trendNote, { color: t.inkFaint, marginTop: spacing(3) }]}>
        Routines are reminders for your day. Marking something as done still happens on the Today screen, so your journal never gets duplicates.
      </Text>
    </View>
  );
}

import { X as XIcon } from 'lucide-react-native';
const X = XIcon;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
  },
  title: { fontSize: 30, lineHeight: 36 },
  babyPicker: { gap: spacing(1.5) },
  babyChip: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyChipText: { fontSize: 14, fontWeight: '600' },
  tabRow: {
    flexDirection: 'row',
    marginTop: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing(2),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  scroll: {
    padding: spacing(4),
    paddingBottom: spacing(10),
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDetail: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  doseLine: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  cardActions: {
    flexDirection: 'row',
    gap: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing(2.5),
    paddingTop: spacing(2),
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    minHeight: 40,
  },
  cardActionText: { fontSize: 13, fontWeight: '600' },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing(1.5),
    marginTop: spacing(1.5),
  },
  adminText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(2),
  },
  addCardText: { fontSize: 15, fontWeight: '700' },
  panelHeading: { fontSize: 16, fontWeight: '700', marginBottom: spacing(1.5) },
  trendLine: { fontSize: 14, lineHeight: 20 },
  trendNote: { fontSize: 12, lineHeight: 18, marginTop: spacing(2) },
  latestLine: { fontSize: 14, fontWeight: '600', marginTop: spacing(1) },
  latestValues: { fontSize: 18, fontWeight: '700', marginTop: spacing(1), fontVariant: ['tabular-nums'] },
  yearHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing(3),
    marginBottom: spacing(1.5),
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing(2) },
  emptyInline: { fontSize: 14, lineHeight: 20, marginBottom: spacing(2) },
  demoNote: { fontSize: 13, lineHeight: 20, marginTop: spacing(3), textAlign: 'center' },
  centerBtnWrap: { paddingHorizontal: spacing(4), paddingBottom: spacing(8) },
  bigBtn: {
    minHeight: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  },
  bigBtnText: { fontSize: 16, fontWeight: '700' },
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
    maxHeight: '88%',
  },
});
