import type { ActiveTimer, CareEvent } from './types';
import { timerElapsedMinutes } from './timers';
import { uuid } from './uuid';

export interface TimerExtras {
  durationMin?: number;
  amountMl?: number;
  side?: 'left' | 'right' | 'both';
  note?: string;
}

// Builds the journal event a stopped timer should produce. Pure — no writes.
export function buildTimerEvent(timer: ActiveTimer, extras?: TimerExtras): CareEvent | null {
  const minutes =
    extras?.durationMin !== undefined
      ? Math.round(extras.durationMin)
      : Math.round(timerElapsedMinutes(timer));
  const event = {
    id: uuid(),
    babyId: timer.babyId,
    type: timer.kind,
    timestamp: new Date().toISOString(),
    durationMin: minutes,
    ...(timer.kind === 'feed_breast'
      ? { side: extras?.side ?? timer.side ?? timer.lastSide ?? 'both' }
      : {}),
    ...(timer.kind === 'pump'
      ? { amountMl: Math.max(0, Math.round(extras?.amountMl ?? 0)), ...(extras?.side ? { side: extras.side } : {}) }
      : {}),
    ...(extras?.note?.trim() ? { note: extras.note.trim() } : {}),
    ...(timer.isDemo ? { isDemo: true } : {}),
  } as unknown as CareEvent;
  return event;
}

export interface EventWriter {
  addEvent(event: CareEvent): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  deleteTimer(timerId: string): Promise<void>;
  /**
   * OPTIONAL atomic path (see CareRepository.completeTimerAtomic): adapters
   * that can commit the event and the timer removal in one storage-level
   * transaction expose it here. When present it is always preferred.
   */
  completeTimerAtomic?(event: CareEvent, timerId: string): Promise<void>;
}

// Safe timer completion ordering:
//  0. adapters with completeTimerAtomic commit BOTH writes in one storage
//     transaction — no intermediate state exists at all;
//  otherwise:
//  1. build + validate the event FIRST (validation failure => timer untouched)
//  2. commit the event
//  3. only then remove the timer
// If removing the timer fails after the event committed, the event is rolled
// back so no duplicate is created on retry and the timer keeps running.
export async function commitTimerCompletion(
  repo: EventWriter,
  timer: ActiveTimer,
  isValidEvent: (e: CareEvent) => boolean,
  extras?: TimerExtras
): Promise<{ ok: boolean; event: CareEvent | null }> {
  const event = buildTimerEvent(timer, extras);
  if (!event || !isValidEvent(event)) return { ok: false, event: null };
  if (typeof repo.completeTimerAtomic === 'function') {
    try {
      await repo.completeTimerAtomic(event, timer.id);
      return { ok: true, event };
    } catch {
      // the adapter owns the transaction: nothing was committed on failure
      return { ok: false, event };
    }
  }
  try {
    await repo.addEvent(event);
  } catch {
    return { ok: false, event };
  }
  try {
    await repo.deleteTimer(timer.id);
  } catch {
    // Roll back the committed event so the timer can be stopped again cleanly.
    await repo.deleteEvent(event.id).catch(() => {});
    return { ok: false, event };
  }
  return { ok: true, event };
}
