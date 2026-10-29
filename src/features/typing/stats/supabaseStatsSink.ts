import { getSupabase } from '../../../lib/supabase';
import type { StatsSink } from './types';
// TODO(supabase): used by the commented-out match_mode below.
// import { DEFAULT_GAME_MODE } from '../gameModes';

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
      // TODO(supabase): send the game mode once save_match_stats accepts it
      // (see db/matches/game-mode.todo.sql). Leave commented until then: the
      // RPC rejects calls with a parameter it doesn't have, so every save
      // would fail. Until then Classic and Time Attack save the same way.
      // match_mode: result.mode ?? DEFAULT_GAME_MODE,
    });

    // 23505 = this exact match was already saved
    if (error && error.code !== '23505') throw error;
  },
};
