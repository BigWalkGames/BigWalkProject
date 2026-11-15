import { getSupabase } from '../../../lib/supabase';

export interface Improvement {
  kind: 'bigram' | 'key';
  item: string;
  current_accuracy: number;
  previous_accuracy: number; // Accruracy from last 10 matches
}

export async function fetchImprovements(matchEnd: string): Promise<Improvement[]> {
  const { data, error } = await getSupabase().rpc('get_match_improvements', {
    match_end: matchEnd,
  });
  if (error) throw error;
  return (data ?? []).map((row: Improvement) => ({
    ...row,
    current_accuracy: Number(row.current_accuracy),
    previous_accuracy: Number(row.previous_accuracy),
  }));
}
