// ============================================================================
// BOILERPLATE — stats team: finish this file.
//
// Contract: `saveResult` gets one TestResult (see ./types.ts) per finished
// test. Resolve when it's stored, throw if it isn't; the UI shows
// "Saved" / "Couldn't save" based on that.
//
// To turn it on, change DEFAULT_STATS_SINK in ../components/TypingTest.tsx
// from consoleStatsSink to supabaseStatsSink.
//
// Checklist:
//   [ ] Create the table (suggested schema below) and set RESULTS_TABLE.
//   [ ] Add an RLS INSERT policy, e.g. `with check (auth.uid() = user_id)`.
//   [ ] Decide how guests are handled (currently: user_id is null, which the
//       policy above would reject).
//   [ ] Adjust the column mapping in `toRow` to match the table.
//
// Suggested schema:
//   create table typing_results (
//     id               bigint generated always as identity primary key,
//     user_id          uuid references auth.users (id),
//     mode             text not null default 'solo_time_attack',
//     duration_ms      integer not null,
//     wpm              real not null,
//     raw_wpm          real not null,
//     accuracy         real not null,   -- 0..1, correct / all keystrokes
//     per_key          jsonb not null,  -- { "a": { attempts, correct, accuracy, mistypedAs }, " ": {...} }
//     word_bank_source text not null,   -- 'supabase' | 'fallback'
//     completed_at     timestamptz not null
//   );
//
// per_key is a single jsonb column to keep this simple. If you need to query
// per-key stats across many tests (e.g. "weakest keys this month"), move it
// to its own table: (result_id, key, attempts, correct).
// The raw keystroke log (result.keystrokes) is not stored by default.
// ============================================================================

import { supabase } from '../../../lib/supabase'
import type { StatsSink, TestResult } from './types'

// TODO(stats team): replace with the real table name.
const RESULTS_TABLE = 'typing_results'

export const supabaseStatsSink: StatsSink = {
  async saveResult(result) {
    const { data: auth } = await supabase.auth.getUser()

    const { error } = await supabase
      .from(RESULTS_TABLE)
      .insert(toRow(result, auth.user?.id ?? null))

    if (error) throw error
  },
}

// TODO(stats team): match these keys to the table's columns.
function toRow(result: TestResult, userId: string | null) {
  return {
    user_id: userId,
    mode: 'solo_time_attack',
    duration_ms: Math.round(result.durationMs),
    wpm: result.wpm,
    raw_wpm: result.rawWpm,
    accuracy: result.accuracy,
    per_key: result.perKey,
    word_bank_source: result.wordBankSource,
    completed_at: result.completedAt,
  }
}
