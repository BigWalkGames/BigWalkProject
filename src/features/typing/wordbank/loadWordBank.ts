import { FALLBACK_WORDS } from './fallbackWordBank'
import { supabaseWordBank } from './supabaseWordBank'
import type { LoadedWordBank, WordBankSource } from './types'

const DEFAULT_TIMEOUT_MS = 3000

/**
 * Tries `primary` (Supabase by default) and falls back to FALLBACK_WORDS if it
 * errors, times out, or produces no usable words. Never rejects.
 * Called again on every restart, so a Supabase outage only lasts one test.
 */
export async function loadWordBank(
  primary: WordBankSource = supabaseWordBank,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<LoadedWordBank> {
  try {
    const raw = await primary.fetchWords(AbortSignal.timeout(timeoutMs))
    const words = normalizeWords(raw)
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
