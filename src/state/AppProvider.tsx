import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRepository } from '@/src/data/repositoryFactory';
import type { CareRepository } from '@/src/data/CareRepository';
import type {
  ActiveTimer, AppData, Baby, CareEvent, GrowthRecord, MedicationAdministration,
  MedicationRecord, MilestoneRecord, RoutineTemplate, VaccinationRecord,
} from '@/src/models/types';
import { buildDemoData, DEMO_BABY_ID_CONSTANT } from '@/src/models/demoData';
import { commitTimerCompletion, type TimerExtras } from '@/src/models/timerCompletion';
import { planImport, applyImportPlan, describeImportPlan, type ImportPlan } from '@/src/models/importPlan';
import { remapEmbeddedPhotos, createMediaPort, type EmbeddedPhoto } from '@/src/models/mediaBackup';
import { sweepImportStaging } from '@/src/models/backupRestore';
import { deleteBabyMediaDir, deletePhotoIfInManagedDir } from '@/src/models/media';
import {
  validateEvent, validateBaby, validateTimer, validateGrowth, validateMilestone,
  validateMedication, validateMedicationAdministration, validateVaccination, validateRoutine,
} from '@/src/models/validation';
import {
  timerElapsedMinutes,
  pauseTimer,
  resumeTimer,
  switchSideFrom,
  sanitizeSegments,
} from '@/src/models/timers';
import type { ThemeMode } from '@/src/design/tokens';
import type { Locale, ClockFormat } from '@/src/i18n/strings';
import { makeT, type TFunc } from '@/src/i18n/strings';

type Status = 'loading' | 'ready' | 'error';

const ACTIVE_BABY_KEY = 'ninninest.activeBabyId';
const LOCALE_KEY = 'ninninest.locale';
const CLOCK_KEY = 'ninninest.clockFormat';
const THEME_KEY = 'ninninest.themeMode';
const DEMO_FLAG_KEY = 'ninninest.demoActive';

// In-flight write guards: prevent double-taps from creating duplicate records.
const eventWrites = new Set<string>();
const stoppingTimers = new Set<string>();

interface AppContextValue {
  status: Status;
  error: string | null;
  repo: CareRepository;
  data: AppData;
  isDemo: boolean;
  currentBaby: Baby | null;
  currentBabyId: string | null;
  setActiveBaby: (id: string) => void;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  clockFormat: ClockFormat;
  setClockFormat: (c: ClockFormat) => void;
  t: TFunc;
  refresh: () => Promise<void>;
  addBaby: (baby: Baby) => Promise<boolean>;
  updateBaby: (baby: Baby) => Promise<boolean>;
  deleteBaby: (id: string) => Promise<boolean>;
  addEvent: (e: CareEvent) => Promise<boolean>;
  updateEvent: (e: CareEvent) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  addTimer: (t: ActiveTimer) => Promise<boolean>;
  updateTimer: (t: ActiveTimer) => Promise<boolean>;
  stopTimer: (
    timerId: string,
    extras?: TimerExtras
  ) => Promise<boolean>;
  pauseActiveTimer: (timerId: string) => Promise<boolean>;
  resumeActiveTimer: (timerId: string) => Promise<boolean>;
  switchActiveTimerSide: (timerId: string, side: 'left' | 'right') => Promise<boolean>;
  addGrowthRecord: (g: GrowthRecord) => Promise<boolean>;
  deleteGrowthRecord: (id: string) => Promise<boolean>;
  addMilestone: (m: MilestoneRecord) => Promise<boolean>;
  deleteMilestone: (id: string) => Promise<boolean>;
  addMedication: (m: MedicationRecord) => Promise<boolean>;
  deleteMedication: (id: string) => Promise<boolean>;
  addMedicationAdministration: (a: MedicationAdministration) => Promise<boolean>;
  deleteMedicationAdministration: (id: string) => Promise<boolean>;
  addVaccination: (v: VaccinationRecord) => Promise<boolean>;
  deleteVaccination: (id: string) => Promise<boolean>;
  addRoutine: (r: RoutineTemplate) => Promise<boolean>;
  deleteRoutine: (id: string) => Promise<boolean>;
  enterDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
  resetPersonal: () => Promise<void>;
  importData: (json: string) => Promise<{ ok: boolean; message: string }>;
  exportJson: () => Promise<string>;
  planPendingImport: (json: string, mode: 'replace' | 'merge') => ImportPlan;
  applyPendingImport: (plan: ImportPlan) => Promise<{ ok: boolean; message: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY: AppData = {
  babies: [], events: [], activeTimers: [], growthRecords: [], milestones: [],
  medications: [], medicationAdministrations: [], vaccinations: [], routines: [],
  schemaVersion: 3,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const repo = useMemo(() => createRepository(), []);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(EMPTY);
  const [isDemo, setIsDemo] = useState(false);
  const [activeBabyId, setActiveBabyIdState] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>('day');
  const [locale, setLocaleState] = useState<Locale>('en');
  const [clockFormat, setClockFormatState] = useState<ClockFormat>('12h');

  const t = useMemo(() => makeT(locale), [locale]);

  const setThemeModePersisted = useCallback((m: ThemeMode) => {
    setThemeMode(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem(LOCALE_KEY, l).catch(() => {});
  }, []);

  const setClockFormat = useCallback((c: ClockFormat) => {
    setClockFormatState(c);
    AsyncStorage.setItem(CLOCK_KEY, c).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const loaded = await repo.loadAll();
      setData({
        babies: loaded.babies.map(validateBaby).filter((b): b is Baby => b !== null),
        events: loaded.events.map(validateEvent).filter((e): e is CareEvent => e !== null),
        activeTimers: loaded.activeTimers
          .map((raw) => {
            const validated = validateTimer(raw);
            if (!validated) return null;
            // Guard against impossible segment data (future end times, inverted ranges).
            return { ...validated, segments: sanitizeSegments(validated.segments) };
          })
          .filter((t): t is ActiveTimer => t !== null),
        growthRecords: (loaded.growthRecords ?? [])
          .map(validateGrowth)
          .filter((g): g is GrowthRecord => g !== null),
        milestones: (loaded.milestones ?? [])
          .map(validateMilestone)
          .filter((m): m is MilestoneRecord => m !== null),
        medications: (loaded.medications ?? [])
          .map(validateMedication)
          .filter((m): m is MedicationRecord => m !== null),
        medicationAdministrations: (loaded.medicationAdministrations ?? [])
          .map(validateMedicationAdministration)
          .filter((a): a is MedicationAdministration => a !== null),
        vaccinations: (loaded.vaccinations ?? [])
          .map(validateVaccination)
          .filter((v): v is VaccinationRecord => v !== null),
        routines: (loaded.routines ?? [])
          .map(validateRoutine)
          .filter((r): r is RoutineTemplate => r !== null),
        schemaVersion: 3,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read saved data');
      setStatus('error');
    }
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await repo.init();
        // Crash recovery: staging debris from an interrupted backup import is
        // never referenced by committed state, so it is always safe to sweep
        // at launch (native only; web has no managed media area).
        if (Platform.OS !== 'web') {
          await sweepImportStaging(createMediaPort());
        }
        const stored = await AsyncStorage.getItem(ACTIVE_BABY_KEY).catch(() => null);
        if (!cancelled && stored) setActiveBabyIdState(stored);
        const storedLocale = await AsyncStorage.getItem(LOCALE_KEY).catch(() => null);
        if (!cancelled && (storedLocale === 'en' || storedLocale === 'ta')) setLocaleState(storedLocale);
        const storedClock = await AsyncStorage.getItem(CLOCK_KEY).catch(() => null);
        if (!cancelled && (storedClock === '12h' || storedClock === '24h')) setClockFormatState(storedClock);
        const storedTheme = await AsyncStorage.getItem(THEME_KEY).catch(() => null);
        if (!cancelled && (storedTheme === 'day' || storedTheme === 'night' || storedTheme === 'nightWarm')) {
          setThemeMode(storedTheme);
        }
        // Restore demo mode across restarts BEFORE first load so the personal
        // realm is never exposed (or mutated) while a demo session is active.
        const storedDemo = await AsyncStorage.getItem(DEMO_FLAG_KEY).catch(() => null);
        const demoActive = storedDemo === '1';
        if (demoActive) await repo.setDemoMode(true);
        if (!cancelled) setIsDemo(demoActive);
        await refresh();
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not open local storage');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      repo.close().catch(() => {});
    };
  }, [repo, refresh]);

  const persistEvent = useCallback(
    async (event: CareEvent, mode: 'add' | 'update'): Promise<boolean> => {
      if (isDemo && !event.isDemo) return false;
      if (eventWrites.has(event.id)) return false; // double-tap guard
      eventWrites.add(event.id);
      try {
        if (mode === 'add') await repo.addEvent(event);
        else await repo.updateEvent(event);
        await refresh();
        return true;
      } catch {
        return false;
      } finally {
        eventWrites.delete(event.id);
      }
    },
    [repo, refresh, isDemo]
  );

  const addEvent = useCallback((e: CareEvent) => persistEvent(e, 'add'), [persistEvent]);
  const updateEvent = useCallback((e: CareEvent) => persistEvent(e, 'update'), [persistEvent]);

  const addBaby = useCallback(
    async (baby: Baby) => {
      if (isDemo) return false;
      try {
        await repo.addBaby(baby);
        setActiveBabyIdState(baby.id);
        AsyncStorage.setItem(ACTIVE_BABY_KEY, baby.id).catch(() => {});
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, isDemo]
  );

  const updateBaby = useCallback(
    async (baby: Baby) => {
      if (isDemo && !baby.isDemo) return false;
      try {
        await repo.updateBaby(baby);
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, isDemo]
  );

  const deleteBaby = useCallback(
    async (id: string) => {
      if (isDemo) return false;
      try {
        await repo.deleteBaby(id);
        // Only after the record cascade committed: reclaim this baby's managed
        // media directory (profile photo + milestone photos live there).
        await deleteBabyMediaDir(id);
        if (activeBabyId === id) {
          setActiveBabyIdState(null);
          AsyncStorage.removeItem(ACTIVE_BABY_KEY).catch(() => {});
        }
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, isDemo, activeBabyId]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        await repo.deleteEvent(id);
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh]
  );

  const addTimer = useCallback(
    async (t: ActiveTimer) => {
      if (isDemo && !t.isDemo) return false;
      try {
        await repo.addTimer(t);
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, isDemo]
  );

  const updateTimer = useCallback(
    async (t: ActiveTimer) => {
      if (isDemo && !t.isDemo) return false;
      try {
        await repo.addTimer(t);
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, isDemo]
  );

  const mutateTimer = useCallback(
    async (timerId: string, fn: (t: ActiveTimer) => ActiveTimer) => {
      const timer = data.activeTimers.find((t) => t.id === timerId);
      if (!timer) return false;
      try {
        await repo.addTimer(fn(timer));
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, data.activeTimers]
  );

  const pauseActiveTimer = useCallback(
    (timerId: string) => mutateTimer(timerId, (t) => pauseTimer(t)),
    [mutateTimer]
  );

  const resumeActiveTimer = useCallback(
    (timerId: string) => mutateTimer(timerId, (t) => resumeTimer(t)),
    [mutateTimer]
  );

  const switchActiveTimerSide = useCallback(
    (timerId: string, side: 'left' | 'right') =>
      mutateTimer(timerId, (t) => switchSideFrom(t, side)),
    [mutateTimer]
  );

  const stopTimer = useCallback(
    async (
      timerId: string,
      extras?: TimerExtras
    ) => {
      const timer = data.activeTimers.find((t) => t.id === timerId);
      if (!timer) return false;
      if (stoppingTimers.has(timerId)) return false; // double-tap guard
      stoppingTimers.add(timerId);
      try {
        // Commit-ordering invariant: the journal event is written first and the
        // timer is removed only once the record is durably saved. If removing
        // the timer fails, the event is rolled back so a retry cannot duplicate.
        const result = await commitTimerCompletion(repo, timer, (e) => validateEvent(e) !== null, extras);
        if (!result.ok) return false;
        await refresh();
        return true;
      } catch {
        return false;
      } finally {
        stoppingTimers.delete(timerId);
      }
    },
    [repo, refresh, data.activeTimers]
  );

  // Generic Phase C persistence; validates at the boundary and refreshes state.
  const usePhaseCCrud = <T extends { id: string; babyId: string; isDemo?: boolean }>(
    add: (item: T) => Promise<void>,
    del: (id: string) => Promise<void>
  ) => ({
    addFn: useCallback(
      async (item: T) => {
        if (isDemo && !item.isDemo) return false;
        try {
          await add(item);
          await refresh();
          return true;
        } catch {
          return false;
        }
      },
      [add, refresh, isDemo]
    ),
    deleteFn: useCallback(
      async (id: string) => {
        try {
          await del(id);
          await refresh();
          return true;
        } catch {
          return false;
        }
      },
      [del, refresh]
    ),
  });

  const growthCrud = usePhaseCCrud<GrowthRecord>(
    (g) => repo.addGrowthRecord(g),
    (id) => repo.deleteGrowthRecord(id)
  );
  const milestoneCrud = usePhaseCCrud<MilestoneRecord>(
    (m) => repo.addMilestone(m),
    (id) => repo.deleteMilestone(id)
  );
  // Milestone deletion also reclaims the photo file — but only after the
  // record delete committed, and only if the file is in managed storage.
  const deleteMilestone = useCallback(
    async (id: string) => {
      const milestone = data.milestones.find((m) => m.id === id);
      const ok = await milestoneCrud.deleteFn(id);
      if (ok && milestone?.photoUri) await deletePhotoIfInManagedDir(milestone.photoUri);
      return ok;
    },
    [data.milestones, milestoneCrud.deleteFn]
  );
  const medicationCrud = usePhaseCCrud<MedicationRecord>(
    (m) => repo.addMedication(m),
    (id) => repo.deleteMedication(id)
  );
  const administrationCrud = usePhaseCCrud<MedicationAdministration>(
    (a) => repo.addMedicationAdministration(a),
    (id) => repo.deleteMedicationAdministration(id)
  );
  const vaccinationCrud = usePhaseCCrud<VaccinationRecord>(
    (v) => repo.addVaccination(v),
    (id) => repo.deleteVaccination(id)
  );
  const routineCrud = usePhaseCCrud<RoutineTemplate>(
    (r) => repo.addRoutine(r),
    (id) => repo.deleteRoutine(id)
  );

  const currentBaby = useMemo(() => {
    if (isDemo) return data.babies.find((b) => b.id === DEMO_BABY_ID_CONSTANT) ?? null;
    const candidates = data.babies.filter((b) => !b.isDemo);
    if (candidates.length === 0) return null;
    const explicit = activeBabyId ? candidates.find((b) => b.id === activeBabyId) : undefined;
    return explicit ?? candidates[0];
  }, [data.babies, isDemo, activeBabyId]);

  const setActiveBaby = useCallback((id: string) => {
    setActiveBabyIdState(id);
    AsyncStorage.setItem(ACTIVE_BABY_KEY, id).catch(() => {});
  }, []);

  const enterDemo = useCallback(async () => {
    try {
      // The adapter swaps storage realms; personal rows are never touched.
      await repo.setDemoMode(true);
      await repo.replaceAll(buildDemoData());
      setIsDemo(true);
      AsyncStorage.setItem(DEMO_FLAG_KEY, '1').catch(() => {});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start demo');
    }
  }, [repo, refresh]);

  const exitDemo = useCallback(async () => {
    try {
      // Restore personal data BEFORE clearing the flag so a crash mid-exit
      // leaves demo mode on (safe) rather than off with a wrecked realm.
      await repo.setDemoMode(false);
      setIsDemo(false);
      AsyncStorage.setItem(DEMO_FLAG_KEY, '0').catch(() => {});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not exit demo');
    }
  }, [repo, refresh]);

  const resetPersonal = useCallback(async () => {
    try {
      await repo.replaceAll(EMPTY);
      setIsDemo(false);
      setActiveBabyIdState(null);
      AsyncStorage.removeItem(ACTIVE_BABY_KEY).catch(() => {});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not erase data');
    }
  }, [repo, refresh]);

  const applyPendingImport = useCallback(
    async (plan: ImportPlan): Promise<{ ok: boolean; message: string }> => {
      if (!plan.ok || !plan.target) {
        const firstError = plan.issues.find((i) => i.severity === 'error');
        return { ok: false, message: firstError ? firstError.message : 'The backup could not be validated. Nothing was written.' };
      }
      const result = await applyImportPlan(repo, plan);
      if (!result.ok) return result;
      setIsDemo(false);
      AsyncStorage.setItem(DEMO_FLAG_KEY, '0').catch(() => {});
      await refresh();
      return result;
    },
    [repo, refresh]
  );

  const importData = useCallback(
    async (json: string): Promise<{ ok: boolean; message: string }> => {
      const plan = planImport(json, data, 'replace');
      if (!plan.ok || !plan.target) {
        const firstError = plan.issues.find((i) => i.severity === 'error');
        return { ok: false, message: firstError ? firstError.message : 'The backup could not be validated. Nothing was written.' };
      }
      return applyPendingImport(plan);
    },
    [data, applyPendingImport]
  );

  const planPendingImport = useCallback(
    (json: string, mode: 'replace' | 'merge') => planImport(json, data, mode),
    [data]
  );

  const exportJson = useCallback(async () => {
    return JSON.stringify({ ...data, exportedAt: new Date().toISOString(), app: 'NinniNest', schemaVersion: 3 }, null, 2);
  }, [data]);

  const value: AppContextValue = {
    status, error, repo, data, isDemo, currentBaby,
    currentBabyId: currentBaby?.id ?? null,
    setActiveBaby,
    themeMode, setThemeMode: setThemeModePersisted,
    locale, setLocale, clockFormat, setClockFormat, t,
    refresh, addBaby, updateBaby, deleteBaby,
    addEvent, updateEvent, deleteEvent, addTimer, updateTimer, stopTimer,
    pauseActiveTimer, resumeActiveTimer, switchActiveTimerSide,
    addGrowthRecord: growthCrud.addFn,
    deleteGrowthRecord: growthCrud.deleteFn,
    addMilestone: milestoneCrud.addFn,
    deleteMilestone,
    addMedication: medicationCrud.addFn,
    deleteMedication: medicationCrud.deleteFn,
    addMedicationAdministration: administrationCrud.addFn,
    deleteMedicationAdministration: administrationCrud.deleteFn,
    addVaccination: vaccinationCrud.addFn,
    deleteVaccination: vaccinationCrud.deleteFn,
    addRoutine: routineCrud.addFn,
    deleteRoutine: routineCrud.deleteFn,
    enterDemo, exitDemo, resetPersonal, importData, exportJson,
    planPendingImport, applyPendingImport,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useEventsForBaby(babyId: string | undefined, includeDemo: boolean): CareEvent[] {
  const { data, isDemo } = useApp();
  return useMemo(() => {
    if (!babyId) return [];
    const all = data.events.filter((e) => e.babyId === babyId);
    if (includeDemo && isDemo) return all;
    return all.filter((e) => !e.isDemo);
  }, [data.events, babyId, isDemo, includeDemo]);
}

export const platformIsWeb = Platform.OS === 'web';
