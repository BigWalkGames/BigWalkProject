import { periodRange, type HistoryPeriod } from '../../hooks/historyPeriod';
import type { HistoryEntry } from '../../hooks/useMatchHistory';

export const DAY = 86_400_000;

export type Outcome = 'win' | 'loss' | 'draw';

/** One plotted point. outcome is set when each point is a single multiplayer match. */
export type Point = { t: number; wpm: number; acc: number; outcome?: Outcome };

/** A match passed in from outside (multiplayer history). */
export type GraphMatch = { time: string; wpm: number; accuracy: number; outcome: Outcome };

export type Axis = {
  t0: number;
  t1: number;
  ticks: number[];
  tickLabel: (t: number) => string;
  pointLabel: (t: number) => string;
};

const dayMonth = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' });
const hour = new Intl.DateTimeFormat('en-US', { hour: 'numeric' });
const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const month = new Intl.DateTimeFormat('en-US', { month: 'short' });

const startOfDay = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * The points to plot. The Day filter shows every match at its time of day;
 * longer periods show one point per day (that day's average WPM and accuracy).
 */
export function graphPoints(entries: HistoryEntry[], period: HistoryPeriod): Point[] {
  if (period === 'day') {
    return entries
      .map((e) => ({ t: new Date(e.id).getTime(), wpm: e.wpm, acc: e.accuracy })) // id is the match timestamp
      .sort((a, b) => a.t - b.t);
  }

  const days = new Map<number, { wpm: number; acc: number; n: number }>();
  for (const e of entries) {
    const day = startOfDay(new Date(e.id).getTime());
    const sum = days.get(day) ?? { wpm: 0, acc: 0, n: 0 };
    sum.wpm += e.wpm;
    sum.acc += e.accuracy;
    sum.n += 1;
    days.set(day, sum);
  }
  return [...days.entries()]
    .map(([t, s]) => ({ t, wpm: s.wpm / s.n, acc: s.acc / s.n }))
    .sort((a, b) => a.t - b.t);
}

/**
 * Every match as its own point, oldest first, on every filter. Used for
 * multiplayer, where each point carries its win / loss / draw, which a daily
 * average could not show.
 */
export function matchPoints(matches: GraphMatch[]): Point[] {
  return matches
    .map((m) => ({ t: new Date(m.time).getTime(), wpm: m.wpm, acc: m.accuracy, outcome: m.outcome }))
    .sort((a, b) => a.t - b.t);
}

/** Evenly spaced ticks from t0 to t1, inclusive. */
function evenTicks(t0: number, t1: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => t0 + ((t1 - t0) * i) / (count - 1));
}

/**
 * The time range and tick labels for the x axis. A filtered period spans the
 * whole period (the selected day, week, month or year), so the graph lines up
 * with the filter even when only part of it has matches. 'All' spans the first
 * match to today.
 */
export function graphAxis(
  period: HistoryPeriod,
  points: Point[],
  plotWidth: number,
  now = new Date(),
): Axis {
  const tickCount = Math.max(2, Math.floor(plotWidth / 90));

  if (period === 'all') {
    // Same spacing the Account graph always used: about one label per 110 px, at most 7.
    const allTicks = Math.max(2, Math.min(7, Math.floor(plotWidth / 110)));
    const t0 = points[0]?.t ?? startOfDay(now.getTime());
    const t1 = Math.max(startOfDay(now.getTime()), t0 + DAY);
    const fmt = (t: number) => dayMonth.format(new Date(t));
    return { t0, t1, ticks: evenTicks(t0, t1, allTicks), tickLabel: fmt, pointLabel: fmt };
  }

  const [from, to] = periodRange(period, now);
  const start = from.getTime();

  if (period === 'day') {
    const end = to.getTime();
    // 3 h steps when there is room, otherwise 6 h, so ticks land on round hours.
    const step = tickCount >= 9 ? 3 : 6;
    const ticks = Array.from({ length: 24 / step + 1 }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate(), i * step).getTime());
    return {
      t0: start,
      t1: end,
      ticks,
      tickLabel: (t) => hour.format(new Date(t)),
      pointLabel: (t) => time.format(new Date(t)),
    };
  }

  // Daily points sit at midnight, so the axis ends on the period's last day.
  const end = to.getTime() - DAY;
  const fmt = (t: number) => dayMonth.format(new Date(t));

  if (period === 'week') {
    const ticks = Array.from({ length: 7 }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i).getTime());
    return { t0: start, t1: end, ticks, tickLabel: fmt, pointLabel: fmt };
  }

  if (period === 'month') {
    return { t0: start, t1: end, ticks: evenTicks(start, end, Math.min(7, tickCount)), tickLabel: fmt, pointLabel: fmt };
  }

  // year: one tick per month start, skipping some when the graph is narrow.
  const step = Math.ceil(12 / Math.min(12, tickCount));
  const ticks: number[] = [];
  for (let m = 0; m < 12; m += step) ticks.push(new Date(from.getFullYear(), m, 1).getTime());
  return { t0: start, t1: end, ticks, tickLabel: (t) => month.format(new Date(t)), pointLabel: fmt };
}
