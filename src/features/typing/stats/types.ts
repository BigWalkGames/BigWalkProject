import type { WordBankSourceName } from '../wordbank/types'

/** One forward keystroke. Backspaces are not logged. */
export interface Keystroke {
  /** Character the test expected (a-z or ' '). */
  expected: string
  /** Character actually typed (any printable key, including capitals). */
  typed: string
  correct: boolean
  /** Milliseconds since the test started. */
  t: number
}

export interface KeyStats {
  attempts: number
  correct: number
  /** correct / attempts, from 0 to 1. */
  accuracy: number
  /** Wrong characters typed when this key was expected, with counts. */
  mistypedAs: Record<string, number>
}

export interface TestResult {
  durationMs: number
  /** Net WPM: correctly typed characters on screen / 5 per minute. */
  wpm: number
  /** Raw WPM: every forward keystroke / 5 per minute. */
  rawWpm: number
  /**
   * Correct keystrokes / all keystrokes, from 0 to 1. Mistakes still count
   * even if they were later fixed with backspace.
   */
  accuracy: number
  /** Keyed by the EXPECTED character; only a-z and ' ' (space) are tracked. */
  perKey: Record<string, KeyStats>
  keystrokes: Keystroke[]
  wordBankSource: WordBankSourceName
  /** ISO timestamp of when the test ended. */
  completedAt: string
}

/**
 * Where finished results go. The game calls `saveResult` once per finished
 * test and shows "saved" / "not saved" based on whether it resolves.
 */
export interface StatsSink {
  saveResult(result: TestResult): Promise<void>
}
