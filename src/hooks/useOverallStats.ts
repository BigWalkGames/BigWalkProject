import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from './auth/useAuth';

/** One row returned by the get_overall_stats RPC. */
type StatsRow = {
  wpm: number;
  accuracy: number; // 0-1
};

export type OverallStats = {
  wpm: number; // rounded
  accuracy: number; // 0-100
};

export function useOverallStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getSupabase()
      .rpc('get_overall_stats', { id: user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('get_overall_stats failed', error);
          setFailed(true);
          return;
        }
        const row = (data as StatsRow[] | null)?.[0];
        setStats({
          wpm: Math.round(Number(row?.wpm ?? 0)),
          accuracy: Math.round(Number(row?.accuracy ?? 0) * 100),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const status = failed
    ? 'Could not load stats.'
    : stats === null
      ? 'Loading...'
      : null;

  return { stats, status };
}
