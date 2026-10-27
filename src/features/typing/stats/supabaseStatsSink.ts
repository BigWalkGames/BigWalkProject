import { getSupabase } from '../../../lib/supabase';
import type { StatsSink } from './types';

export const supabaseStatsSink: StatsSink = {
  async saveResult(result) {
    const supabase = getSupabase();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) throw authError ?? new Error('Not signed in');

    const { error } = await supabase.rpc('save_match_stats', {
      id: data.user.id,
      match_end: result.completedAt,
      match_accuracy: result.accuracy,
      match_wpm: result.wpm,
    });

    // 23505 = this exact match was already saved
    if (error && error.code !== '23505') throw error;
  },
};
