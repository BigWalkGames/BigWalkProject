import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from './auth/useAuth';

/** One row of users.matches, as returned by the get_all_matches RPC. */
type MatchRow = {
  account_id: string;
  match_time: string;
  accuracy: number; // 0-1
  wpm: number;
};

export type HistoryEntry = {
  id: string;
  date: string;       // formatted, e.g. "09/08/26"
  wpm: number;
  accuracy: number;   // 0-100
};

export type HistoryPeriod = 'all' | 'day' | 'week' | 'month' | 'year';

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

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: '2-digit',
});

/** The rows loaded for one period; rows is null when the request failed. */
type Result = { period: HistoryPeriod; rows: MatchRow[] | null };

export function useMatchHistory(period: HistoryPeriod = 'all') {
  const { user } = useAuth();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // The range is worked out when the filter is picked, so "today" is the browser's today.
    const range = period === 'all' ? null : periodRange(period);
    const args = range
      ? { id: user.id, p_from: range[0].toISOString(), p_to: range[1].toISOString() }
      : { id: user.id };

    getSupabase()
      .rpc('get_all_matches', args)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('get_all_matches failed', error);
          setResult({ period, rows: null });
          return;
        }
        const rows = (data ?? []) as MatchRow[];
        rows.sort((a, b) => b.match_time.localeCompare(a.match_time));
        setResult({ period, rows });
      });

    return () => {
      cancelled = true;
    };
  }, [user, period]);

  // Rows from the previous filter are not shown while the new ones load.
  const current = result?.period === period ? result : null;
  const matches = current?.rows;

  const entries: HistoryEntry[] = (matches ?? []).map((row) => ({
    id: row.match_time,
    date: dateFormat.format(new Date(row.match_time)),
    wpm: Math.round(Number(row.wpm)),
    accuracy: Math.round(Number(row.accuracy) * 100),
  }));

  const status = !current
    ? 'Loading...'
    : !matches
      ? 'Could not load match history.'
      : matches.length === 0
        ? period === 'all'
          ? 'No matches yet.'
          : 'No matches in this period.'
        : null;

  return { entries, status };
}