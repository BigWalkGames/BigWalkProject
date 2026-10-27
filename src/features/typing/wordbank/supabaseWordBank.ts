import { getSupabase } from '../../../lib/supabase'
import type { Word } from '../../../features/word-engine'
import type { WordBankSource } from './types'

const WORDS_TABLE = 'words'
// const WORD_COLUMN = 'word'
const PAGE_SIZE = 1000

export const supabaseWordBank: WordBankSource = {
  name: 'supabase',

  async fetchWords(signal) {
    const rows: Record<string, any>[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await getSupabase()
        .from(WORDS_TABLE)
        .select('*')
        .order('rank')
        .range(from, from + PAGE_SIZE - 1)
        .abortSignal(signal)

      if (error) throw error

      rows.push(...data)
      if (data.length < PAGE_SIZE) break
    }

    return rows.map((r): Word => ({
      rank: r.rank,
      word: r.word,
      length: r.length,
      letters: r.letters,
      letterMask: r.letter_mask,
      hand: r.hand,
      bigrams: r.bigrams,
      alternationCount: r.alternation_count,
      rollCount: r.roll_count,
      rowJumpCount: r.row_jump_count,
      sameFingerCount: r.same_finger_count,
      repeatCount: r.repeat_count,
    }))
  },
}

export async function loadWords(): Promise<Word[]> {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await getSupabase()
      .from('words')
      .select('*')
      .order('rank')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows.map((r) => ({
    rank: r.rank,
    word: r.word,
    length: r.length,
    letters: r.letters,
    letterMask: r.letter_mask,
    hand: r.hand,
    bigrams: r.bigrams,
    alternationCount: r.alternation_count,
    rollCount: r.roll_count,
    rowJumpCount: r.row_jump_count,
    sameFingerCount: r.same_finger_count,
    repeatCount: r.repeat_count,
  }))
}
