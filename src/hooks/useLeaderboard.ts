import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { periodRange, type HistoryPeriod } from './historyPeriod';

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
  recentMatch: number | null; // ms timestamp of the player's latest match
};

/** The first of `keys` present on the row, as a number (0 when missing). */
function num(row: LeaderboardRow, ...keys: string[]): number {
  for (const key of keys) {
    if (row[key] != null) return Number(row[key]) || 0;
  }
  return 0;
}

/**
 * recent_match comes back as a timestamp without a time zone, for example
 * "2026-11-12T04:43:20.314". Supabase stores those in UTC, so it is read as
 * UTC; a value that already has a zone is read as given.
 */
export function parseUtc(value: unknown): number | null {
  if (value == null || value === '') return null;
  const text = String(value);
  const hasZone = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(text);
  const t = Date.parse(hasZone ? text : `${text.replace(' ', 'T')}Z`);
  return Number.isNaN(t) ? null : t;
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
    recentMatch: parseUtc(row.recent_match ?? row['Recent Match']),
  };
}

/**
 * The players whose latest match falls in `period` (today, this week, month or
 * year, in local time), ranked again from 1. The RPC only returns all-time
 * totals per player, so the stats shown stay all-time; the filter decides who
 * appears. 'all' returns everyone.
 */
export function filterLeaderboard(
  entries: LeaderboardEntry[],
  period: HistoryPeriod,
  now = new Date(),
): LeaderboardEntry[] {
  if (period === 'all') return entries;
  const [from, to] = periodRange(period, now);
  return entries
    .filter((e) => e.recentMatch != null && e.recentMatch >= from.getTime() && e.recentMatch < to.getTime())
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/** null while loading; rows is null when the request failed. */
type Result = { rows: LeaderboardRow[] | null } | null;

/**
 * Every registered player who has played multiplayer, best effective WPM
 * (WPM x accuracy) first. The RPC sorts the list. Filter it by period with
 * filterLeaderboard.
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
