// ============================================================================
// BOILERPLATE — word bank team: finish this file.
//
// Contract: `fetchWords` resolves with a list of words, or throws. That's it.
// If it throws, returns an empty list, or takes longer than the loader's
// timeout, the game falls back to FALLBACK_WORDS automatically, so this file
// can stay unfinished without breaking anything.
//
// Checklist:
//   [ ] Set WORDS_TABLE / WORD_COLUMN to the real table and column names.
//   [ ] Make sure the table has an RLS SELECT policy for the `anon` role
//       (and/or `authenticated`). With RLS on and no policy, Supabase returns
//       an EMPTY list rather than an error, and the game silently uses the
//       fallback.
//   [ ] Optional: add filters (difficulty, language, ...) where marked below.
// ============================================================================

import { supabase } from '../../../lib/supabase'
import type { WordBankSource } from './types'

// TODO(word bank team): replace with the real table and column names.
const WORDS_TABLE = 'words'
const WORD_COLUMN = 'word'

export const supabaseWordBank: WordBankSource = {
  name: 'supabase',

  async fetchWords(signal) {
    const { data, error } = await supabase
      .from(WORDS_TABLE)
      .select(WORD_COLUMN)
      // TODO(word bank team): add filters here if needed, e.g.
      // .eq('difficulty', 'easy')
      .abortSignal(signal)

    if (error) throw error

    return (data as Record<string, unknown>[])
      .map((row) => row[WORD_COLUMN])
      .filter((word): word is string => typeof word === 'string')
  },
}
