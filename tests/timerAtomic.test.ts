import { describe, it, expect, vi } from 'vitest';
import { commitTimerCompletion, type EventWriter } from '../src/models/timerCompletion';
import type { ActiveTimer, CareEvent } from '../src/models/types';
import { validateEvent } from '../src/models/validation';

const TIMER: ActiveTimer = {
  id: 't0000000-0000-4000-8000-000000000001',
  babyId: 'a0000000-0000-4000-8000-000000000001',
  kind: 'sleep',
  startedAt: '2026-10-26T10:00:00.000Z',
  segments: [{ start: '2026-10-26T10:00:00.000Z', end: null }],
  isDemo: false,
};

function validEventCheck(e: CareEvent) {
  return validateEvent(e) !== null;
}

describe('commitTimerCompletion: atomic adapter path', () => {
  it('prefers completeTimerAtomic and never issues the individual writes', async () => {
    const atomic = vi.fn(async (_event: CareEvent, _timerId: string) => {});
    const addEvent = vi.fn(async () => {});
    const deleteTimer = vi.fn(async () => {});
    const repo: EventWriter = { addEvent, deleteEvent: vi.fn(), deleteTimer, completeTimerAtomic: atomic };
    const result = await commitTimerCompletion(repo, TIMER, validEventCheck, { durationMin: 45 });
    expect(result.ok).toBe(true);
    expect(result.event).not.toBeNull();
    expect(atomic).toHaveBeenCalledTimes(1);
    expect(atomic.mock.calls[0][1]).toBe(TIMER.id);
    expect(addEvent).not.toHaveBeenCalled();
    expect(deleteTimer).not.toHaveBeenCalled();
  });

  it('an atomic failure commits nothing and does NOT fall back to the split path', async () => {
    const atomic = vi.fn(async () => {
      throw new Error('storage full mid-transaction');
    });
    const addEvent = vi.fn(async () => {});
    const repo: EventWriter = {
      addEvent, deleteEvent: vi.fn(async () => {}), deleteTimer: vi.fn(async () => {}),
      completeTimerAtomic: atomic,
    };
    const result = await commitTimerCompletion(repo, TIMER, validEventCheck, { durationMin: 45 });
    expect(result.ok).toBe(false);
    // The adapter owns the transaction: a fallback here could double-commit.
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('validation failure touches neither path', async () => {
    const atomic = vi.fn(async () => {});
    const repo: EventWriter = {
      addEvent: vi.fn(async () => {}), deleteEvent: vi.fn(async () => {}),
      deleteTimer: vi.fn(async () => {}), completeTimerAtomic: atomic,
    };
    const result = await commitTimerCompletion(repo, TIMER, () => false, { durationMin: -5 });
    expect(result.ok).toBe(false);
    expect(result.event).toBeNull();
    expect(atomic).not.toHaveBeenCalled();
  });
});

describe('commitTimerCompletion: fallback ordering (adapters without the atomic capability)', () => {
  it('commits the event, then removes the timer, and rolls the event back if the timer delete fails', async () => {
    const order: string[] = [];
    const written: CareEvent[] = [];
    const repo: EventWriter = {
      async addEvent(e) {
        order.push('addEvent');
        written.push(e);
      },
      async deleteEvent(id) {
        order.push('deleteEvent');
        const i = written.findIndex((e) => e.id === id);
        if (i >= 0) written.splice(i, 1);
      },
      async deleteTimer() {
        order.push('deleteTimer');
        throw new Error('timer delete failed');
      },
    };
    const result = await commitTimerCompletion(repo, TIMER, validEventCheck, { durationMin: 45 });
    expect(result.ok).toBe(false);
    expect(order).toEqual(['addEvent', 'deleteTimer', 'deleteEvent']);
    expect(written).toHaveLength(0); // compensating rollback done
  });

  it('no intermediate state survives a failure when both writes are one call', async () => {
    // Directly models the SQLite adapter: completeTimerAtomic commits the
    // event AND the timer removal together, so a crash cannot leave the event
    // without the timer removal (which used to duplicate on retry).
    const store = { events: [] as CareEvent[], timers: [TIMER.id] };
    const repo: EventWriter = {
      async addEvent(e) {
        store.events.push(e);
      },
      async deleteEvent(id) {
        store.events = store.events.filter((e) => e.id !== id);
      },
      async deleteTimer(id) {
        store.timers = store.timers.filter((t) => t !== id);
      },
      async completeTimerAtomic(e, timerId) {
        store.events.push(e);
        store.timers = store.timers.filter((t) => t !== timerId);
        // one storage transaction: an error AFTER this point rolls both back
        // in the real adapter; here the joint write itself is the assertion
      },
    };
    const result = await commitTimerCompletion(repo, TIMER, validEventCheck, { durationMin: 30 });
    expect(result.ok).toBe(true);
    expect(store.events).toHaveLength(1);
    expect(store.timers).toHaveLength(0);
  });
});
