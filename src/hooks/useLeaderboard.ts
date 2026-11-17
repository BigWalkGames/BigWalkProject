import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';

/**
 * One row of get_multiplayer_leaderboard_revised(). The SQL file names the
 * columns username / raw_wpm / accuracy / wins / effective_wpm, but the view
 * behind it uses "Username" / "Raw WPM" / ..., so both spellings are read.
 */
type LeaderboardRow = Record<string, unknown>;

export type LeaderboardEntry = {
  rank: number;
  name: string;
  wpm: number;
  accuracy: number; // 0-100
  wins: number;
};

/** The first of `keys` present on the row, as a number (0 when missing). */
function num(row: LeaderboardRow, ...keys: string[]): number {
  for (const key of keys) {
    if (row[key] != null) return Number(row[key]) || 0;
  }
  return 0;
}

function str(row: LeaderboardRow, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] != null) return String(row[key]);
  }
  return 'Player';
}

export function toEntry(row: LeaderboardRow, index: number): LeaderboardEntry {
  const accuracy = num(row, 'accuracy', 'Accuracy');
  return {
    rank: index + 1,
    name: str(row, 'username', 'Username'),
    wpm: Math.round(num(row, 'raw_wpm', 'Raw WPM')),
    // Stored as 0-1 elsewhere in the database; accept 0-100 too.
    accuracy: Math.round(accuracy <= 1 ? accuracy * 100 : accuracy),
    wins: Math.round(num(row, 'wins', 'Number of Wins')),
  };
}

/** null while loading; rows is null when the request failed. */
type Result = { rows: LeaderboardRow[] | null } | null;

/**
 * Every registered player who has played multiplayer, best effective WPM
 * (WPM x accuracy) first. The RPC sorts the list.
 *
 * TODO(supabase): the RPC has no date range yet, so the Day / Week / Month /
 * Year tabs all show the all-time list. Once it takes p_from / p_to, pass
 * periodParams(period) here like useMatchHistory does.
 */
export function useLeaderboard() {
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    let cancelled = false;

    getSupabase()
      .rpc('get_multiplayer_leaderboard_revised')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('get_multiplayer_leaderboard_revised failed', error);
          setResult({ rows: null });
          return;
        }
        setResult({ rows: (data ?? []) as LeaderboardRow[] });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = result?.rows;
  const entries = (rows ?? []).map(toEntry);

  const status = !result
    ? 'Loading...'
    : !rows
      ? 'Could not load leaderboard.'
      : rows.length === 0
        ? 'No players yet.'
        : null;

  return { entries, status };
}
