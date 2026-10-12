import type { TestResult } from '../typing/stats/types'
import type { KeyCounts, PlayerData } from './types.ts'

export interface ProfileOptions {
  /** Only the newest this-many results count. Default 20. */
  maxResults?: number
  /**
   * Each older result counts this many times as much as the next newer one.
   * Default 0.87 (about a 5-result half-life), so the profile follows a
   * player's improvement within a session. 1 = all results equal.
   */
  decay?: number
}

/** The subset of TestResult the profile needs (saved rows may omit the rest). */
export type ProfileInput = Pick<TestResult, 'wpm' | 'accuracy' | 'perKey' | 'durationMs' | 'completedAt'>

/**
 * Combine a player's recent results into one PlayerData for the engine.
 * Returns null when there is no history (the engine treats that as a new
 * player).
 *
 * - perKey: recency-weighted sums of attempts/correct (not averaged
 *   accuracies), so a letter typed 200 times outweighs one typed twice.
 * - wpm: weighted by recency and by test length.
 * - accuracy: weighted correct / weighted attempts over every tracked key
 *   (including space); falls back to the weighted mean of result accuracy.
 */
export function profileFromResults(
  results: readonly ProfileInput[],
  { maxResults = 20, decay = 0.87 }: ProfileOptions = {},
): PlayerData | null {
  if (results.length === 0) return null

  const window = [...results]
    .sort((a, b) => (a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0))
    .slice(-maxResults)

  // Newest is last with weight 1; repeated multiplication (no pow) keeps
  // this bit-identical to the Python reference.
  const weights = window.map(() => 1)
  for (let i = window.length - 2; i >= 0; i -= 1) weights[i] = weights[i + 1] * decay

  let wpmNum = 0
  let wpmDen = 0
  const perKey = new Map<string, { attempts: number; correct: number }>()
  window.forEach((result, i) => {
    const w = weights[i]
    wpmNum += w * result.wpm * result.durationMs
    wpmDen += w * result.durationMs
    for (const [key, stats] of Object.entries(result.perKey)) {
      let agg = perKey.get(key)
      if (!agg) {
        agg = { attempts: 0, correct: 0 }
        perKey.set(key, agg)
      }
      agg.attempts += w * stats.attempts
      agg.correct += w * stats.correct
    }
  })
  const wpm = wpmDen > 0 ? wpmNum / wpmDen : 0

  let attempts = 0
  let correct = 0
  for (const agg of perKey.values()) {
    attempts += agg.attempts
    correct += agg.correct
  }
  let accuracy: number
  if (attempts > 0) {
    accuracy = correct / attempts
  } else {
    let num = 0
    let den = 0
    window.forEach((result, i) => {
      num += weights[i] * result.accuracy
      den += weights[i]
    })
    accuracy = num / den
  }

  return {
    wpm,
    accuracy: Math.min(Math.max(accuracy, 0), 1),
    perKey: Object.fromEntries(perKey) as Record<string, KeyCounts>,
  }
}
