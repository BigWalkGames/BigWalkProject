/**
 * WordEngine: player data + a word collection in, a word bank out.
 *
 * Pure: no I/O, no storage, no React. Callers supply the words (from the
 * word bank loader) and the player data (from profileFromResults).
 *
 * Pipeline:
 *   per-key counts -> smoothed per-key accuracy -> skill level (0-100)
 *   skill + difficulty class -> target word difficulty (percentile)
 *   smoothed accuracy -> weak keys -> share of the bank targeting them
 *
 * This is a line-for-line port of the Python reference in
 * word-engine-claude/engine.py; tests/word-engine/parity.test.ts checks that
 * both produce identical banks for the same seed.
 */

import { DEFAULT_ENGINE_CONFIG, DEFAULT_GLOBAL_KEYS } from './config.ts'
import { prepareWords, round2, wordDifficulty } from './difficulty.ts'
import { LETTERS, type Letter } from './letters.ts'
import { createRng, shuffle, weightedSample } from './random.ts'
import {
  WordEngineError,
  type BankRequest,
  type EngineConfig,
  type GlobalKeyAccuracy,
  type PlayerData,
  type WordBankResult,
  type WordEngine,
} from './types.ts'

export interface CreateWordEngineOptions {
  /** Overrides for DEFAULT_ENGINE_CONFIG. */
  config?: Partial<EngineConfig>
  /**
   * App-wide accuracy per letter. Fills letters a player has never typed.
   * Defaults to DEFAULT_GLOBAL_KEYS; pass {} to use no global data.
   */
  globalKeys?: GlobalKeyAccuracy
}

const DEFAULT_COUNT = 20

export function createWordEngine(options: CreateWordEngineOptions = {}): WordEngine {
  const config: Readonly<EngineConfig> = Object.freeze({
    ...DEFAULT_ENGINE_CONFIG,
    ...options.config,
  })
  validateConfig(config)

  const source = options.globalKeys ?? DEFAULT_GLOBAL_KEYS
  const globalKeys = new Map<Letter, number>()
  for (const letter of LETTERS) {
    const value = source[letter]
    if (value === undefined) continue
    checkUnit(`globalKeys.${letter}`, value)
    globalKeys.set(letter, value)
  }

  /** [wpm, overall accuracy], with new-player defaults. */
  function profileValues(player: PlayerData | null): [number, number] {
    if (player === null) {
      if (globalKeys.size === 0) return [config.newPlayerWpm, config.newPlayerAccuracy]
      let sum = 0
      for (const value of globalKeys.values()) sum += value
      return [config.newPlayerWpm, sum / globalKeys.size]
    }
    checkUnit('accuracy', player.accuracy)
    if (!(player.wpm >= 0) || !Number.isFinite(player.wpm)) {
      throw new WordEngineError(`wpm must be a number >= 0, got ${player.wpm}`)
    }
    return [player.wpm, player.accuracy]
  }

  function keyAccuracy(player: PlayerData | null): Record<Letter, number> {
    const [, overall] = profileValues(player)
    const k = config.priorAttempts
    const out = {} as Record<Letter, number>

    for (const letter of LETTERS) {
      // `?.` on perKey too: untyped callers (e.g. raw DB rows) may omit it
      const stats = player?.perKey?.[letter]
      const attempts = stats?.attempts ?? 0
      const correct = stats?.correct ?? 0
      if (!(correct >= 0) || !(attempts >= correct)) {
        throw new WordEngineError(
          `perKey.${letter} needs 0 <= correct <= attempts, got ${correct}/${attempts}`,
        )
      }
      // Never typed: global data, else overall. Typed: smoothed toward overall.
      out[letter] =
        attempts === 0
          ? (globalKeys.get(letter) ?? overall)
          : (correct + k * overall) / (attempts + k)
    }
    return out
  }

  function stretch(accuracy: number): number {
    const floor = config.accuracyFloor
    return Math.min(Math.max((accuracy - floor) / (1 - floor), 0), 1)
  }

  function skillLevel(player: PlayerData | null): number {
    const [wpm, overall] = profileValues(player)
    const keys = keyAccuracy(player)
    let sum = 0
    for (const letter of LETTERS) sum += keys[letter]
    const meanKey = sum / 26

    const score =
      config.weightWpm * Math.min(wpm / config.wpmCap, 1) +
      config.weightOverallAccuracy * stretch(overall) +
      config.weightKeyAccuracy * stretch(meanKey)
    return round2(score * 100)
  }

  function weakKeys(keys: Readonly<Record<Letter, number>>): Letter[] {
    let sum = 0
    for (const letter of LETTERS) sum += keys[letter]
    const mean = sum / 26
    return LETTERS.filter((letter) => keys[letter] < mean - 1e-9) // 1e-9: float noise
      .sort((a, b) => keys[a] - keys[b] || (a < b ? -1 : a > b ? 1 : 0))
      .slice(0, config.weakKeyCount)
  }

  function build(
    input: Iterable<string>,
    player: PlayerData | null,
    request: BankRequest = {},
  ): WordBankResult {
    const requested = request.count ?? DEFAULT_COUNT
    const difficultyClass = request.difficulty ?? 'adaptive'
    if (!Number.isInteger(requested) || requested < 1) {
      throw new WordEngineError(`count must be an integer >= 1, got ${requested}`)
    }
    const offset = config.difficultyOffsets[difficultyClass]
    if (offset === undefined) {
      throw new WordEngineError(
        `unknown difficulty '${difficultyClass}'; expected one of ` +
          Object.keys(config.difficultyOffsets).sort().join(', '),
      )
    }
    const absolute = request.targetDifficulty
    if (absolute !== undefined && !(absolute >= 0 && absolute <= 100)) {
      throw new WordEngineError(`targetDifficulty must be 0-100, got ${absolute}`)
    }

    const words = prepareWords(input)
    if (words.length === 0) throw new WordEngineError('word collection has no usable words')
    const rng = createRng(request.seed)

    // Ranked over the whole collection so avoided words don't shift ratings.
    const difficulty = wordDifficulty(words)
    const avoid = new Set(request.avoid ?? [])
    let candidates = words.filter((w) => !avoid.has(w))
    if (candidates.length < requested) candidates = words // too few left: allow repeats
    const count = Math.min(requested, candidates.length)

    const keys = keyAccuracy(player)
    const skill = skillLevel(player)
    const weak = weakKeys(keys)
    const target = absolute ?? Math.min(Math.max(skill + offset, 0), 100)

    // Pool of words near the target, widened until it has variety. At
    // window 100 it holds every candidate, so it always has enough words.
    let window = config.difficultyWindow
    const minPool = count * config.minPoolMultiplier
    let pool: string[]
    for (;;) {
      pool = candidates.filter((w) => Math.abs(difficulty[w] - target) <= window)
      if (pool.length >= minPool || window >= 100) break
      window += 5
    }

    // Weak-key share grows with skill
    const weakRatio =
      config.weakRatioMin + (config.weakRatioMax - config.weakRatioMin) * (skill / 100)
    const weakTarget = weak.length > 0 ? Math.floor(count * weakRatio + 0.5) : 0

    // Weak-key words come from a wider window so rare letters can be found
    let chosen: string[] = []
    if (weakTarget > 0) {
      const weakSet = new Set<string>(weak)
      const scoredWords: string[] = []
      const scores: number[] = []
      for (const w of candidates) {
        if (Math.abs(difficulty[w] - target) > window * 2) continue
        const score = weakScore(w, weakSet, keys)
        if (score > 0) {
          scoredWords.push(w)
          scores.push(score)
        }
      }
      chosen = weightedSample(scoredWords, scores, weakTarget, rng)
    }
    const weakWordCount = chosen.length

    // Fill the rest with random words near the target
    const taken = new Set(chosen)
    const rest = pool.filter((w) => !taken.has(w))
    shuffle(rest, rng)
    chosen = chosen.concat(rest.slice(0, count - chosen.length))
    shuffle(chosen, rng)

    let difficultySum = 0
    for (const w of chosen) difficultySum += difficulty[w]

    return {
      words: chosen,
      skill,
      targetDifficulty: round2(target),
      weakKeys: weak,
      weakRatio: Math.floor(weakRatio * 1000 + 0.5) / 1000,
      weakWordCount,
      keyAccuracy: keys,
      meanDifficulty: difficultySum / chosen.length,
    }
  }

  return {
    config,
    build,
    select: (words, player, request) => build(words, player, request).words,
    skillLevel,
    keyAccuracy,
    weakKeys,
  }
}

/** Density of weak letters in a word, weighted by how weak each one is. */
function weakScore(word: string, weak: ReadonlySet<string>, keys: Record<Letter, number>): number {
  let sum = 0
  for (const char of word) {
    if (weak.has(char)) sum += 1 - keys[char as Letter]
  }
  return sum / word.length
}

function checkUnit(name: string, value: number): void {
  if (!(value >= 0 && value <= 1)) {
    throw new WordEngineError(`${name} must be between 0 and 1, got ${value}`)
  }
}

function validateConfig(c: Readonly<EngineConfig>): void {
  if (!(c.accuracyFloor >= 0 && c.accuracyFloor < 1)) {
    throw new WordEngineError(`accuracyFloor must be in [0, 1), got ${c.accuracyFloor}`)
  }
  if (!(c.wpmCap > 0)) throw new WordEngineError(`wpmCap must be > 0, got ${c.wpmCap}`)
  checkUnit('weakRatioMin', c.weakRatioMin)
  checkUnit('weakRatioMax', c.weakRatioMax)
  const nonNegative = [
    'weightWpm', 'weightOverallAccuracy', 'weightKeyAccuracy', 'priorAttempts',
    'difficultyWindow', 'weakKeyCount', 'minPoolMultiplier',
  ] as const
  for (const name of nonNegative) {
    if (!(c[name] >= 0)) throw new WordEngineError(`${name} must be >= 0, got ${c[name]}`)
  }
}
