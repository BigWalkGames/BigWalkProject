import { countLetters, type Board } from '../models/Board'
import type { WordBankSourceName } from '../wordbank/types'
import type { KeyStats, Keystroke, TestResult } from './types'

/** Keys that get per-key stats: lowercase letters and space. */
const TRACKED_KEY = /^[a-z ]$/

/** Correct keystrokes / all keystrokes, 0 to 1. Returns 0 before any typing. */
export function computeAccuracy(keystrokes: Keystroke[]): number {
  if (keystrokes.length === 0) return 0
  return keystrokes.filter((k) => k.correct).length / keystrokes.length
}

/** Standard WPM: characters / 5 per minute. */
export function computeWpm(chars: number, elapsedMs: number): number {
  if (elapsedMs < 1000) return 0
  return chars / 5 / (elapsedMs / 60_000)
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

export function computeResult(params: {
  board: Board
  keystrokes: Keystroke[]
  startedAt: number
  endedAt: number
  source: WordBankSourceName
}): TestResult {
  const { board, keystrokes, startedAt, endedAt, source } = params
  const durationMs = endedAt - startedAt

  return {
    durationMs,
    wpm: computeWpm(countLetters(board, 'success'), durationMs),
    rawWpm: computeWpm(keystrokes.length, durationMs),
    accuracy: computeAccuracy(keystrokes),
    perKey: computePerKey(keystrokes),
    keystrokes,
    wordBankSource: source,
    completedAt: new Date(endedAt).toISOString(),
  }
}
