import { describe, expect, it } from 'vitest';
import { DAY, graphAxis, graphPoints } from './graphAxis';

const entry = (iso: string, wpm: number, accuracy: number) => ({ id: iso, date: '', wpm, accuracy });

// Wednesday, 18 Nov 2026, 3 PM local time
const now = new Date(2026, 10, 18, 15);

describe('graphPoints', () => {
  const entries = [
    entry(new Date(2026, 10, 18, 9).toISOString(), 40, 90),
    entry(new Date(2026, 10, 18, 14).toISOString(), 60, 100),
    entry(new Date(2026, 10, 17, 10).toISOString(), 50, 80),
  ];

  it('shows every match on the Day filter, oldest first', () => {
    const points = graphPoints(entries, 'day');
    expect(points.map((p) => p.wpm)).toEqual([50, 40, 60]);
  });

  it('averages each day on longer filters', () => {
    const points = graphPoints(entries, 'week');
    expect(points).toEqual([
      { t: new Date(2026, 10, 17).getTime(), wpm: 50, acc: 80 },
      { t: new Date(2026, 10, 18).getTime(), wpm: 50, acc: 95 },
    ]);
  });
});

describe('graphAxis', () => {
  it('spans the selected day with hour ticks', () => {
    const axis = graphAxis('day', [], 1000, now);
    expect(axis.t0).toBe(new Date(2026, 10, 18).getTime());
    expect(axis.t1).toBe(new Date(2026, 10, 19).getTime());
    expect(axis.ticks).toHaveLength(9);
  });

  it('spans Sunday to Saturday with one tick per day', () => {
    const axis = graphAxis('week', [], 1000, now);
    expect(axis.t0).toBe(new Date(2026, 10, 15).getTime());
    expect(axis.t1).toBe(new Date(2026, 10, 21).getTime());
    expect(axis.ticks).toHaveLength(7);
  });

  it('spans the whole month and year', () => {
    expect(graphAxis('month', [], 1000, now).t1).toBe(new Date(2026, 10, 30).getTime());
    const year = graphAxis('year', [], 1200, now);
    expect(year.t0).toBe(new Date(2026, 0, 1).getTime());
    expect(year.t1).toBe(new Date(2026, 11, 31).getTime());
    expect(year.ticks).toHaveLength(12);
  });

  it('spans the first match to today on All', () => {
    const first = new Date(2026, 9, 1).getTime();
    const axis = graphAxis('all', [{ t: first, wpm: 1, acc: 1 }], 1000, now);
    expect(axis.t0).toBe(first);
    expect(axis.t1).toBe(new Date(2026, 10, 18).getTime());
    expect(axis.t1 - axis.t0).toBeGreaterThanOrEqual(DAY);
  });
});
