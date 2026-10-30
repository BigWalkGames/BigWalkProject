import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from './auth/useAuth';

/** One row of the get_multiplayer_history RPC (the signed-in player's side of a match). */
type MultiplayerRow = {
  match_id: string;
  finished_at: string;
  mode: 'quick_match' | 'custom';
  room_code: string | null;
  outcome: 'win' | 'loss' | 'draw';
  wpm: number;
  accuracy: number;          // 0-1
  opponent_name: string;     // username, or "Guest"
  opponent_wpm: number;
  opponent_accuracy: number; // 0-1
};

export type MultiplayerHistoryEntry = {
  id: string;
  date: string;              // formatted, e.g. "09/08/26"
  mode: string;              // "Quick Match" | "Custom"
  opponent: string;
  outcome: MultiplayerRow['outcome'];
  outcomeLabel: string;      // "Win" | "Loss" | "Draw"
  wpm: number;
  accuracy: number;          // 0-100
  opponentWpm: number;
  opponentAccuracy: number;  // 0-100
};

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: '2-digit',
});

const modeLabel = { quick_match: 'Quick Match', custom: 'Custom' } as const;
const outcomeLabel = { win: 'Win', loss: 'Loss', draw: 'Draw' } as const;

export function useMultiplayerHistory() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MultiplayerRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // The RPC reads the player from the session, and returns newest first.
    getSupabase()
      .rpc('get_multiplayer_history')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('get_multiplayer_history failed', error);
          setFailed(true);
          return;
        }
        setMatches((data ?? []) as MultiplayerRow[]);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const entries: MultiplayerHistoryEntry[] = (matches ?? []).map((row) => ({
    id: row.match_id,
    date: dateFormat.format(new Date(row.finished_at)),
    mode: modeLabel[row.mode],
    opponent: row.opponent_name,
    outcome: row.outcome,
    outcomeLabel: outcomeLabel[row.outcome],
    wpm: Math.round(Number(row.wpm)),
    accuracy: Math.round(Number(row.accuracy) * 100),
    opponentWpm: Math.round(Number(row.opponent_wpm)),
    opponentAccuracy: Math.round(Number(row.opponent_accuracy) * 100),
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
