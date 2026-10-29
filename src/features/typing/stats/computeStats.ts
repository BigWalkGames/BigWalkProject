import { countLetters, type Board } from '../models/Board'
import { DEFAULT_GAME_MODE, GAME_MODES, type GameMode } from '../gameModes'
import type { WordBankSourceName } from '../wordbank/types'
import type { BigramStats, KeyStats, Keystroke, TestResult } from './types'

/** Keys that get per-key stats: lowercase letters and space. */
const TRACKED_KEY = /^[a-z ]$/

/** Correct keystrokes / all keystrokes, 0 to 1. Returns 0 before any typing. */
export function computeAccuracy(keystrokes: Keystroke[]): number {
  if (keystrokes.length === 0) return 0
  return keystrokes.filter((k) => k.correct).length / keystrokes.length
}

/** Standard WPM: characters / 5 per minute. With all characters entered, this is Gross WPM. */
export function computeWpm(chars: number, elapsedMs: number): number {
  if (elapsedMs < 1000) return 0
  return chars / 5 / (elapsedMs / 60_000)
}

/**
 * Net WPM as defined in the project doc (Keith & Ericsson):
 *   Gross WPM - uncorrected errors / minutes
 * `grossChars` is every character entered (right or wrong, not backspaces);
 * `uncorrectedErrors` is characters still wrong at the time of measuring.
 * Never below 0, which the raw formula can go early in a test.
 */
export function computeNetWpm(
  grossChars: number,
  uncorrectedErrors: number,
  elapsedMs: number,
): number {
  if (elapsedMs < 1000) return 0
  const minutes = elapsedMs / 60_000
  return Math.max(0, computeWpm(grossChars, elapsedMs) - uncorrectedErrors / minutes)
}

/**
 * The original (Classic) WPM: correct letters / 5 per minute. Mistakes aren't
 * subtracted, they just don't add to the count.
 */
export function computeClassicWpm(board: Board, elapsedMs: number): number {
  return computeWpm(countLetters(board, 'success'), elapsedMs)
}

/** WPM using the formula of the given game mode (see GAME_MODES). */
export function computeModeWpm(
  mode: GameMode,
  board: Board,
  keystrokeCount: number,
  elapsedMs: number,
): number {
  return GAME_MODES[mode].wpmFormula === 'classic'
    ? computeClassicWpm(board, elapsedMs)
    : computeNetWpm(keystrokeCount, countLetters(board, 'fail'), elapsedMs)
}

export function computePerKey(keystrokes: Keystroke[]): Record<string, KeyStats> {
  const perKey: Record<string, KeyStats> = {}

  for (const { expected, typed, correct } of keystrokes) {
    if (!TRACKED_KEY.test(expected)) continue

    const stats = (perKey[expected] ??= {
      attempts: 0,
      correct: 0,
      accuracy: 0,
      mistypedAs: {},
    })
    stats.attempts += 1
    if (correct) {
      stats.correct += 1
    } else {
      stats.mistypedAs[typed] = (stats.mistypedAs[typed] ?? 0) + 1
    }
  }

  for (const stats of Object.values(perKey)) {
    stats.accuracy = stats.correct / stats.attempts
  }
  return perKey
}

const LETTER = /^[a-z]$/

/**
 * Every bigram typed: two letters next to each other in a word, typed one
 * right after the other. Pairs split by a backspace and retype aren't
 * adjacent on the board, so they don't produce fake bigrams like "ee".
 */
function* bigramPairs(keystrokes: Keystroke[]): Generator<[Keystroke, Keystroke]> {
  for (let i = 1; i < keystrokes.length; i += 1) {
    const prev = keystrokes[i - 1]
    const curr = keystrokes[i]
    const adjacent =
      curr.wordIndex === prev.wordIndex && curr.letterIndex === prev.letterIndex + 1
    if (adjacent && LETTER.test(prev.expected) && LETTER.test(curr.expected)) {
      yield [prev, curr]
    }
  }
}

export function computeBigrams(keystrokes: Keystroke[]): Record<string, BigramStats> {
  const bigrams: Record<string, BigramStats> = {}

  for (const [prev, curr] of bigramPairs(keystrokes)) {
    const stats = (bigrams[prev.expected + curr.expected] ??= {
      attempts: 0,
      correct: 0,
      accuracy: 0,
    })
    stats.attempts += 1
    if (prev.correct && curr.correct) stats.correct += 1
  }

  for (const stats of Object.values(bigrams)) {
    stats.accuracy = stats.correct / stats.attempts
  }
  return bigrams
}

/**
 * Average time in ms from the first letter of a bigram to the second, over
 * clean bigrams only (both letters right), so mistakes don't skew the speed.
 * Returns null when no clean bigram was typed.
 */
export function computeBigramLatency(keystrokes: Keystroke[]): number | null {
  let total = 0
  let count = 0
  for (const [prev, curr] of bigramPairs(keystrokes)) {
    if (!prev.correct || !curr.correct) continue
    total += curr.t - prev.t
    count += 1
  }
  return count === 0 ? null : total / count
}

export function computeResult(params: {
  board: Board
  keystrokes: Keystroke[]
  startedAt: number
  endedAt: number
  source: WordBankSourceName
  mode?: GameMode
}): TestResult {
  const { board, keystrokes, startedAt, endedAt, source, mode = DEFAULT_GAME_MODE } = params
  const durationMs = endedAt - startedAt

  return {
    mode,
    durationMs,
    wpm: computeModeWpm(mode, board, keystrokes.length, durationMs),
    rawWpm: computeWpm(keystrokes.length, durationMs),
    accuracy: computeAccuracy(keystrokes),
    perKey: computePerKey(keystrokes),
    bigrams: computeBigrams(keystrokes),
    bigramLatencyMs: computeBigramLatency(keystrokes),
    keystrokes,
    wordBankSource: source,
    completedAt: new Date(endedAt).toISOString(),
  }
}
