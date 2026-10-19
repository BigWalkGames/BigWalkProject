import { DEFAULT_CONFIG, getWordBank, type Word } from '../../../features/word-engine'
import { FALLBACK_WORDS } from './fallbackWordBank'
import { supabaseWordBank } from './supabaseWordBank'
import type { LoadedWordBank, WordBankSource } from './types'
import { loadPlayer } from '../player/playerStore'

const DEFAULT_TIMEOUT_MS = 3000

// The word list doesn't change during a session, so fetch it once and reuse it.
let cachedWords: Word[] | null = null

const RECENT_BANK_COUNT = 3

// Words from the last few banks, so consecutive matches don't repeat targeted words.
let recentBanks: string[][] = []

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
    // A player failure only costs personalization, not the Supabase word list.
    const player = await loadPlayer().catch((error) => {
      console.warn('[wordbank] player load failed; using common words only.', error)
      return null
    })
    const recent = new Set(recentBanks.flat())
    const words = getWordBank(cachedWords, DEFAULT_CONFIG.bankSize, player, recent).map((w) => w.word)
    if (words.length > 0) {
      recentBanks = [...recentBanks, words].slice(-RECENT_BANK_COUNT)
      return { words, source: primary.name }
    }
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