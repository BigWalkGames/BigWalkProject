import type { Letter } from './letters.ts'

// ---------------------------------------------------------------- inputs

/**
 * Attempts and correct presses for one key. `stats/types.ts` KeyStats
 * already has this shape, so per-key stats from a TestResult work as-is.
 * Counts may be fractional (profileFromResults weights recent tests more).
 */
export interface KeyCounts {
  readonly attempts: number
  readonly correct: number
}

/**
 * What the engine knows about a player. A single `TestResult` already fits
 * this shape; `profileFromResults` combines several into one.
 * `perKey` may contain non-letter keys (e.g. ' '); the engine ignores them.
 */
export interface PlayerData {
  /** Net words per minute, >= 0. */
  readonly wpm: number
  /** Correct keystrokes / all keystrokes, 0..1. */
  readonly accuracy: number
  readonly perKey: Readonly<Partial<Record<string, KeyCounts>>>
}

/** A difficulty class: a key of `EngineConfig.difficultyOffsets`. */
export type DifficultyClass = 'easy' | 'adaptive' | 'hard' | (string & {})

/** What the caller wants back. Every field is optional. */
export interface BankRequest {
  /** How many words to return. Default 20. */
  count?: number
  /** Shifts the target difficulty away from the player's skill. Default 'adaptive'. */
  difficulty?: DifficultyClass
  /** Absolute target difficulty 0-100. Overrides `difficulty` when set. */
  targetDifficulty?: number
  /** Words to leave out if enough others remain (e.g. the previous bank). */
  avoid?: readonly string[]
  /** Makes the bank reproducible. Omit for a fresh random bank each time. */
  seed?: number
}

// ---------------------------------------------------------------- config

/** Tuning knobs. See DEFAULT_ENGINE_CONFIG for values and meaning. */
export interface EngineConfig {
  /** Skill weights; should sum to 1. */
  weightWpm: number
  weightOverallAccuracy: number
  weightKeyAccuracy: number
  /** WPM at or above this counts as full speed. */
  wpmCap: number
  /** Accuracy at or below this counts as 0 in the skill formula; 1.0 counts as 1. */
  accuracyFloor: number
  /** Imaginary attempts at the player's overall accuracy added to each typed letter. 0 = off. */
  priorAttempts: number
  /** Assumed WPM for a player with no history. */
  newPlayerWpm: number
  /** Assumed accuracy for a player with no history when there is no global data. */
  newPlayerAccuracy: number
  /** At most this many weak keys are targeted. */
  weakKeyCount: number
  /** Share of the bank given to weak-key words at skill 0 and at skill 100. */
  weakRatioMin: number
  weakRatioMax: number
  /** Target difficulty offset per difficulty class. */
  difficultyOffsets: Readonly<Record<string, number>>
  /** Words are picked within +/- this many difficulty points of the target. */
  difficultyWindow: number
  /** The window widens until the pool holds count * this many words. */
  minPoolMultiplier: number
}

/** App-wide accuracy per letter, 0..1. Missing letters are allowed. */
export type GlobalKeyAccuracy = Readonly<Partial<Record<Letter, number>>>

// ---------------------------------------------------------------- output

/** A word bank plus the reasoning behind it. `words` is what the game uses. */
export interface WordBankResult {
  /** Unique words, shuffled. Fewer than requested only if the collection is smaller. */
  words: string[]
  /** Player skill, 0-100. */
  skill: number
  /** The difficulty percentile the bank was centred on, 0-100. */
  targetDifficulty: number
  /** Letters the bank targets, weakest first. */
  weakKeys: Letter[]
  /** Share of the bank meant for weak-key words, 0..1. */
  weakRatio: number
  /** How many words were picked for their weak keys. */
  weakWordCount: number
  /** Smoothed accuracy for all 26 letters. */
  keyAccuracy: Record<Letter, number>
  /** Average difficulty of the returned words, 0-100. */
  meanDifficulty: number
}

/** The engine's public surface. Create one with `createWordEngine()`. */
export interface WordEngine {
  readonly config: Readonly<EngineConfig>
  /** Build a word bank with its reasoning. Throws WordEngineError on bad input. */
  build(words: Iterable<string>, player: PlayerData | null, request?: BankRequest): WordBankResult
  /** Same as build(), but just the words. */
  select(words: Iterable<string>, player: PlayerData | null, request?: BankRequest): string[]
  /** Player skill, 0-100. `null` = new player. */
  skillLevel(player: PlayerData | null): number
  /** Smoothed accuracy for all 26 letters. */
  keyAccuracy(player: PlayerData | null): Record<Letter, number>
  /** The weakest letters below the player's mean accuracy, weakest first. */
  weakKeys(keyAccuracy: Readonly<Record<Letter, number>>): Letter[]
}

/** Thrown for invalid input or config. Never thrown for "not enough words". */
export class WordEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WordEngineError'
  }
}
