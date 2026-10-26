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

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: '2-digit',
});

export function useMatchHistory() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getSupabase()
      .rpc('get_all_matches', { id: user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('get_all_matches failed', error);
          setFailed(true);
          return;
        }
        const rows = (data ?? []) as MatchRow[];
        rows.sort((a, b) => b.match_time.localeCompare(a.match_time));
        setMatches(rows);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const entries: HistoryEntry[] = (matches ?? []).map((row) => ({
    id: row.match_time,
    date: dateFormat.format(new Date(row.match_time)),
    wpm: Math.round(Number(row.wpm)),
    accuracy: Math.round(Number(row.accuracy) * 100),
  }));

  const status = failed
    ? 'Could not load match history.'
    : matches === null
      ? 'Loading...'
      : matches.length === 0
        ? 'No matches yet.'
        : null;

  return { entries, status };
}