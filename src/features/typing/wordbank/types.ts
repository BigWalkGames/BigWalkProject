export type WordBankSourceName = 'supabase' | 'fallback'

/**
 * Anything that can supply words for a test. The game only depends on this
 * interface, so a source can be swapped without touching the game code.
 */
export interface WordBankSource {
  name: WordBankSourceName
  /**
   * Resolve with the raw words, or throw / reject on failure.
   * `signal` aborts when the loader gives up waiting.
   * Words don't need to be cleaned: the loader lowercases them and strips
   * anything that isn't a-z.
   */
  fetchWords(signal: AbortSignal): Promise<string[]>
}

export interface LoadedWordBank {
  words: string[]
  source: WordBankSourceName
}
