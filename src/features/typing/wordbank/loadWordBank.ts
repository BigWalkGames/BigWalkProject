import { DEFAULT_CONFIG, getWordBank, type Word } from '../../../features/word-engine'
import { FALLBACK_WORDS } from './fallbackWordBank'
import { supabaseWordBank } from './supabaseWordBank'
import type { LoadedWordBank, WordBankSource } from './types'

const DEFAULT_TIMEOUT_MS = 3000

// The word list doesn't change during a session, so fetch it once and reuse it.
let cachedWords: Word[] | null = null

/**
 * Tries `primary` (Supabase by default), builds the next bank with the word
 * engine, and falls back to FALLBACK_WORDS if it errors, times out, or
 * produces no usable words. Never rejects.
 * The word list is cached after the first success; each call still builds a
 * fresh bank from it.
 */
export async function loadWordBank(
  primary: WordBankSource = supabaseWordBank,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<LoadedWordBank> {
  try {
    cachedWords ??= await primary.fetchWords(AbortSignal.timeout(timeoutMs))
    // No player data yet, so this is common words only.
    const words = getWordBank(cachedWords, DEFAULT_CONFIG.bankSize, null).map((w) => w.word)
    if (words.length > 0) return { words, source: primary.name }
    console.warn(`[wordbank] "${primary.name}" returned no usable words; using fallback.`)
  } catch (error) {
    console.warn(`[wordbank] "${primary.name}" failed; using fallback.`, error)
  }
  return { words: normalizeWords(FALLBACK_WORDS), source: 'fallback' }
}

/** Lowercases, strips everything except a-z, and drops empty results. */
export function normalizeWords(words: string[]): string[] {
  return words
    .map((word) => word.toLowerCase().replace(/[^a-z]/g, ''))
    .filter((word) => word.length > 0)
}