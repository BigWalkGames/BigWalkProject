import type { Tab } from '../components/TabNav/TabNav';

/** Date filter shared by the Time Attack and multiplayer history screens. */
export type HistoryPeriod = 'all' | 'day' | 'week' | 'month' | 'year';

export const PERIOD_TABS: Tab[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

/** [start, end) of the calendar period containing `now`, in the browser's local time. Weeks start on Sunday. */
export function periodRange(period: Exclude<HistoryPeriod, 'all'>, now = new Date()): [Date, Date] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (period) {
    case 'day':
      return [new Date(y, m, d), new Date(y, m, d + 1)];
    case 'week': {
      const sunday = d - now.getDay();
      return [new Date(y, m, sunday), new Date(y, m, sunday + 7)];
    }
    case 'month':
      return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    case 'year':
      return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  }
}

/**
 * The p_from / p_to RPC params for a period; none for 'all'.
 * Call it when the filter is picked, so "today" is the browser's today.
 */
export function periodParams(period: HistoryPeriod): { p_from?: string; p_to?: string } {
  if (period === 'all') return {};
  const [from, to] = periodRange(period);
  return { p_from: from.toISOString(), p_to: to.toISOString() };
}

/** Status line for an empty list: filtered periods get their own message. */
export function emptyMessage(period: HistoryPeriod): string {
  return period === 'all' ? 'No matches yet.' : 'No matches in this period.';
}
