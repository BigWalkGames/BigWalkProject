import type { EngineConfig, GlobalKeyAccuracy } from './types.ts'

/**
 * Default tuning. First guesses, meant for the Sprint 4 tuning pass; every
 * value can be overridden per engine with createWordEngine({ config }).
 */
export const DEFAULT_ENGINE_CONFIG: Readonly<EngineConfig> = Object.freeze({
  weightWpm: 0.5,
  weightOverallAccuracy: 0.3,
  weightKeyAccuracy: 0.2,
  wpmCap: 120,
  accuracyFloor: 0.75,
  priorAttempts: 10,
  newPlayerWpm: 35,
  newPlayerAccuracy: 0.9,
  weakKeyCount: 5,
  weakRatioMin: 0.3,
  weakRatioMax: 0.6,
  difficultyOffsets: Object.freeze({ easy: -20, adaptive: 0, hard: 20 }),
  difficultyWindow: 15,
  minPoolMultiplier: 2,
})

/**
 * Placeholder global typing data (app-wide accuracy per letter) until the
 * real aggregate exists in Supabase. Rarer letters get less practice, so
 * they're assumed less accurate:
 *   0.85 + 0.12 * sqrt(frequency / max frequency), rounded to 3 places.
 * A brand-new player's first banks lean toward the lowest of these.
 */
export const DEFAULT_GLOBAL_KEYS: GlobalKeyAccuracy = Object.freeze({
  a: 0.946, b: 0.888, c: 0.906, d: 0.919, e: 0.97, f: 0.9, g: 0.898,
  h: 0.933, i: 0.939, j: 0.863, k: 0.88, l: 0.918, m: 0.902, n: 0.937,
  o: 0.942, p: 0.897, q: 0.861, r: 0.932, s: 0.935, t: 0.951, u: 0.906,
  v: 0.883, w: 0.902, x: 0.863, y: 0.897, z: 0.859,
})
