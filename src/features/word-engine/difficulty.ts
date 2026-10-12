import { LETTER_FREQUENCY, MAX_FREQUENCY, isLetter } from './letters.ts'

/** Round half up to 2 decimals (matches the Python reference's round2). */
export function round2(x: number): number {
  return Math.floor(x * 100 + 0.5) / 100
}

/**
 * Dedupe, and drop anything that isn't plain a-z. The word bank loader
 * already cleans words; this is a guard so a stray bad word can't break
 * difficulty scoring.
 */
export function prepareWords(words: Iterable<string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const word of words) {
    if (!word || seen.has(word)) continue
    let valid = true
    for (const char of word) {
      if (!isLetter(char)) {
        valid = false
        break
      }
    }
    if (!valid) continue
    seen.add(word)
    out.push(word)
  }
  return out
}

/** 60% length (capped at 12 letters) + 40% average letter rarity, 0..1. */
export function rawDifficulty(word: string): number {
  const length = Math.min(word.length, 12) / 12
  let rarity = 0
  for (const char of word) {
    rarity += 1 - LETTER_FREQUENCY[char as keyof typeof LETTER_FREQUENCY] / MAX_FREQUENCY
  }
  rarity /= word.length
  return 0.6 * length + 0.4 * rarity
}

/**
 * Rate each word 0-100 by its percentile within this collection. Ranking
 * spreads any word set evenly over 0-100, so the engine needs no retuning
 * when the word set changes. Ties keep input order. Expects prepared words.
 */
export function wordDifficulty(words: readonly string[]): Record<string, number> {
  const ranked = words
    .map((word, index) => ({ word, index, raw: rawDifficulty(word) }))
    .sort((a, b) => a.raw - b.raw || a.index - b.index)

  const last = Math.max(ranked.length - 1, 1)
  const out: Record<string, number> = {}
  ranked.forEach(({ word }, i) => {
    out[word] = round2((i / last) * 100)
  })
  return out
}
