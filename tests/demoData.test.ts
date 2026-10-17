import { describe, it, expect } from 'vitest';
import { buildDemoData } from '../src/models/demoData';

describe('demo data', () => {
  it('contains one clearly synthetic baby', () => {
    const d = buildDemoData();
    expect(d.babies).toHaveLength(1);
    expect(d.babies[0].isDemo).toBe(true);
    expect(d.babies[0].name).toContain('Demo');
  });
  it('marks every demo event', () => {
    const d = buildDemoData();
    expect(d.events.length).toBeGreaterThan(5);
    expect(d.events.every((e) => e.isDemo)).toBe(true);
    expect(d.events.every((e) => e.babyId === d.babies[0].id)).toBe(true);
  });
  it('includes an active timer marked as demo', () => {
    const d = buildDemoData();
    expect(d.activeTimers).toHaveLength(1);
    expect(d.activeTimers[0].isDemo).toBe(true);
  });
  it('is reproducible in shape across calls', () => {
    const a = buildDemoData();
    const b = buildDemoData();
    expect(a.events.length).toBe(b.events.length);
    expect(a.babies[0].name).toBe(b.babies[0].name);
  });
});
