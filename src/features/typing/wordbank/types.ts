import type { Word } from '../../../features/word-engine'
export type WordBankSourceName = 'supabase' | 'server' | 'fallback'

/**
 * Anything that can supply words for a test. The game only depends on this
 * interface, so a source can be swapped without touching the game code.
 */
export interface WordBankSource {
  name: WordBankSourceName
  fetchWords(signal: AbortSignal): Promise<Word[]>
}

export interface LoadedWordBank {
  words: string[]
  source: WordBankSourceName
}
