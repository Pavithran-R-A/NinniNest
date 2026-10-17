import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { createRepository } from '@/src/data/repositoryFactory';
import type { CareRepository } from '@/src/data/CareRepository';
import type { ActiveTimer, AppData, Baby, CareEvent } from '@/src/models/types';
import { buildDemoData, DEMO_BABY_ID_CONSTANT } from '@/src/models/demoData';
import { validateEvent, validateBaby, validateTimer } from '@/src/models/validation';
import type { ThemeMode } from '@/src/design/tokens';

type Status = 'loading' | 'ready' | 'error';

interface AppContextValue {
  status: Status;
  error: string | null;
  repo: CareRepository;
  data: AppData;
  isDemo: boolean;
  currentBaby: Baby | null;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  refresh: () => Promise<void>;
  addBaby: (baby: Baby) => Promise<boolean>;
  addEvent: (e: CareEvent) => Promise<boolean>;
  updateEvent: (e: CareEvent) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  addTimer: (t: ActiveTimer) => Promise<boolean>;
  stopTimer: (timerId: string, durationMin: number) => Promise<boolean>;
  enterDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
  resetPersonal: () => Promise<void>;
  importData: (json: string) => Promise<{ ok: boolean; message: string }>;
  exportJson: () => Promise<string>;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY: AppData = { babies: [], events: [], activeTimers: [], schemaVersion: 1 };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const repo = useMemo(() => createRepository(), []);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(EMPTY);
  const [isDemo, setIsDemo] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('day');

  const refresh = useCallback(async () => {
    try {
      const loaded = await repo.loadAll();
      setData({
        babies: loaded.babies.map(validateBaby).filter((b): b is Baby => b !== null),
        events: loaded.events.map(validateEvent).filter((e): e is CareEvent => e !== null),
        activeTimers: loaded.activeTimers.map(validateTimer).filter((t): t is ActiveTimer => t !== null),
        schemaVersion: 1,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read saved data');
      setStatus('error');
    }
  }, [repo]);

  useEffect(() => {
    (async () => {
      try {
        await repo.init();
        await refresh();
        setStatus('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open local storage');
        setStatus('error');
      }
    })();
    return () => {
      repo.close().catch(() => {});
    };
  }, [repo, refresh]);

  const persistEvent = useCallback(
    async (event: CareEvent, mode: 'add' | 'update'): Promise<boolean> => {
      if (isDemo && !event.isDemo) return false;
      try {
        if (mode === 'add') await repo.addEvent(event);
        else await repo.updateEvent(event);
        await refresh();
        return true;
      } catch {
        return false;
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
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, isDemo]
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

  const stopTimer = useCallback(
    async (timerId: string, durationMin: number) => {
      const timer = data.activeTimers.find((t) => t.id === timerId);
      if (!timer) return false;
      try {
        await repo.deleteTimer(timerId);
        const event = {
          id: crypto.randomUUID(),
          babyId: timer.babyId,
          type: timer.kind,
          timestamp: new Date().toISOString(),
          durationMin: Math.round(durationMin),
          ...(timer.kind === 'feed_breast' ? { side: timer.side ?? 'both' } : {}),
          ...(timer.kind === 'pump' ? { amountMl: 0 } : {}),
          ...(timer.isDemo ? { isDemo: true } : {}),
        } as unknown as CareEvent;
        if (!validateEvent(event)) return false;
        await repo.addEvent(event);
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [repo, refresh, data.activeTimers]
  );

  const currentBaby = useMemo(() => {
    if (isDemo) return data.babies.find((b) => b.id === DEMO_BABY_ID_CONSTANT) ?? null;
    return data.babies.find((b) => !b.isDemo) ?? null;
  }, [data.babies, isDemo]);

  const enterDemo = useCallback(async () => {
    try {
      await repo.replaceAll(buildDemoData());
      setIsDemo(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start demo');
    }
  }, [repo, refresh]);

  const exitDemo = useCallback(async () => {
    try {
      await repo.replaceAll(EMPTY);
      setIsDemo(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not exit demo');
    }
  }, [repo, refresh]);

  const resetPersonal = useCallback(async () => {
    try {
      await repo.replaceAll(EMPTY);
      setIsDemo(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not erase data');
    }
  }, [repo, refresh]);

  const importData = useCallback(
    async (json: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const parsed = JSON.parse(json) as Partial<AppData>;
        if (!parsed || !Array.isArray(parsed.babies) || !Array.isArray(parsed.events)) {
          return { ok: false, message: 'This file does not look like a NinniNest backup.' };
        }
        const babies = parsed.babies.map(validateBaby).filter((b): b is Baby => b !== null);
        const events = parsed.events.map(validateEvent).filter((e): e is CareEvent => e !== null);
        if (babies.length === 0) {
          return { ok: false, message: 'No valid baby profiles found in the file.' };
        }
        await repo.replaceAll({ babies, events, activeTimers: [], schemaVersion: 1 });
        setIsDemo(false);
        await refresh();
        return { ok: true, message: `Imported ${babies.length} profile and ${events.length} events.` };
      } catch {
        return { ok: false, message: 'The file could not be read.' };
      }
    },
    [repo, refresh]
  );

  const exportJson = useCallback(async () => {
    return JSON.stringify({ ...data, exportedAt: new Date().toISOString(), app: 'NinniNest', schemaVersion: 1 }, null, 2);
  }, [data]);

  const value: AppContextValue = {
    status, error, repo, data, isDemo, currentBaby, themeMode, setThemeMode,
    refresh, addBaby, addEvent, updateEvent, deleteEvent, addTimer, stopTimer,
    enterDemo, exitDemo, resetPersonal, importData, exportJson,
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
