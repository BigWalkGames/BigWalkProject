import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from './auth/useAuth';
import { emptyMessage, periodParams, type HistoryPeriod } from './historyPeriod';

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

    getSupabase()
      .rpc('get_all_matches', { id: user.id, ...periodParams(period) })
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
        ? emptyMessage(period)
        : null;

  return { entries, status };
}