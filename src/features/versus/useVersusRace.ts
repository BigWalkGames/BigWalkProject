import { useEffect, useReducer, useRef, useState } from 'react'
import { sendProgress } from '../../net/quickMatch'
import { backspace, getCurrentLetter, isFinished, typeChar, type Board } from '../typing/models/Board'
import type { Keystroke } from '../typing/stats/types'
import { useFrameKeys } from '../typing/useFrameKeys'
import { boardFromWords } from './boardFromWords'

/** Roughly 10 updates a second. The server disconnects clients that send more than 30. */
const PROGRESS_INTERVAL_MS = 100

interface State {
  board: Board
  /** Every forward key press, including wrong ones. Backspace does not undo it. */
  typed: number
  /** Key presses that matched the expected letter. */
  correct: number
  /**
   * Letters on the board still marked wrong, kept up to date per key so the
   * live WPM doesn't rescan the board. Backspacing over one lowers it.
   */
  errors: number
  /** The same forward key presses, in order. Used for the per-key table on the results screen. */
  keystrokes: Keystroke[]
}

/** Key presses since the last frame, `t` ms after the start. */
type Action = { type: 'keys'; keys: { key: string; t: number }[] }

/** One letter per completed real word: 'g' if it has no wrong letters, 'r' if it has. */
function wordResults(board: Board): string {
  let out = ''
  for (let i = 0; i < board.wordIndex && i < board.words.length; i += 2) {
    out += board.words[i].letters.some((letter) => letter.status === 'fail') ? 'r' : 'g'
  }
  return out
}

/** The newest totals, read by the progress sender between renders. */
interface Latest {
  typed: number
  correct: number
  errors: number
  board: Board
}

/** The totals as sent to the server. */
function progressOf({ typed, correct, errors, board }: Latest) {
  return { typed, correct, errors, wordResults: wordResults(board) }
}

function reducer(state: State, action: Action): State {
  return action.keys.reduce(applyKey, state)
}

/** One key press, in the order they were typed. */
function applyKey(state: State, action: { key: string; t: number }): State {
  if (action.key === 'Backspace') {
    const board = backspace(state.board)
    if (board === state.board) return state
    const erased = state.board.words[board.wordIndex].letters[board.letterIndex]
    return { ...state, board, errors: state.errors - (erased.status === 'fail' ? 1 : 0) }
  }

  // Word banks are lowercase, so typing is case-insensitive (same as Time Attack).
  const typed = action.key.toLowerCase()
  const expected = getCurrentLetter(state.board)?.char
  const board = typeChar(state.board, typed)
  if (expected === undefined || board === state.board) return state

  return {
    board,
    typed: state.typed + 1,
    correct: state.correct + (expected === typed ? 1 : 0),
    errors: state.errors + (expected === typed ? 0 : 1),
    keystrokes: [
      ...state.keystrokes,
      {
        expected,
        typed,
        correct: expected === typed,
        t: action.t,
        // Position on the board, so the results screen can find bigrams.
        wordIndex: state.board.wordIndex,
        letterIndex: state.board.letterIndex,
      },
    ],
  }
}

/**
 * Typing for a Quick Match (P19). Like the Time Attack test, but:
 *  - the words come from the server, so both players type the same text
 *  - typing starts when the server says "go", not on the first key
 *  - the running totals are sent to the server, which decides the final result
 *
 * @param words      the shared word list from `match_found`
 * @param racing     true between the server's "go" and the end of the race
 * @param startedAt  local clock time (ms) when "go" arrived
 * @param durationMs race length (the server sends it)
 */
export function useVersusRace(words: string[], racing: boolean, startedAt: number | null, durationMs: number) {
  const [state, dispatch] = useReducer(reducer, words, (list: string[]) => ({
    board: boardFromWords(list),
    typed: 0,
    correct: 0,
    errors: 0,
    keystrokes: [],
  }))

  // Stops input when the local time runs out. One timer for the deadline, not
  // a ticking clock: the on-screen countdown ticks inside LiveStats. The
  // server's clock decides the race.
  const [timeIsUp, setTimeIsUp] = useState(false)
  useEffect(() => {
    if (!racing || startedAt === null) return
    const id = setTimeout(() => setTimeIsUp(true), Math.max(0, startedAt + durationMs - Date.now()))
    return () => clearTimeout(id)
  }, [racing, startedAt, durationMs])

  // Accept keys only while the race is on.
  const acceptingInput = racing && !timeIsUp
  useFrameKeys(acceptingInput, (keys) =>
    dispatch({
      type: 'keys',
      keys: keys.map(({ key, at }) => ({ key, t: Math.max(0, at - (startedAt ?? at)) })),
    }),
  )

  // Send the running totals while racing, only when they changed.
  // `errors` (letters still wrong) is for the server's Net WPM; it can go down
  // when the player backspaces over a mistake. The word results string is
  // built only when sending (at most 10 times a second), not on every key.
  const latest = useRef<Latest>({ typed: 0, correct: 0, errors: 0, board: state.board })
  const lastSent = useRef({ typed: -1, correct: -1, errors: -1, wordResults: '' })
  useEffect(() => {
    latest.current = {
      typed: state.typed,
      correct: state.correct,
      errors: state.errors,
      board: state.board,
    }
  }, [state.typed, state.correct, state.errors, state.board])
  // Typed the very last letter: tell the server right away so the race ends now.
  const finishedTyping = isFinished(state.board)
  useEffect(() => {
    if (!racing || !finishedTyping) return
    const { typed, correct, errors, wordResults } = progressOf(latest.current)
    lastSent.current = { typed, correct, errors, wordResults }
    sendProgress(typed, correct, wordResults, errors)
  }, [racing, finishedTyping])
  useEffect(() => {
    if (!racing) return
    const id = setInterval(() => {
      const { typed, correct, errors, wordResults } = progressOf(latest.current)
      const sent = lastSent.current
      if (
        typed === sent.typed &&
        correct === sent.correct &&
        errors === sent.errors &&
        wordResults === sent.wordResults
      ) {
        return
      }
      lastSent.current = { typed, correct, errors, wordResults }
      sendProgress(typed, correct, wordResults, errors)
    }, PROGRESS_INTERVAL_MS)
    return () => clearInterval(id)
  }, [racing])

  return {
    board: state.board,
    typed: state.typed,
    correct: state.correct,
    keystrokes: state.keystrokes,
    // For LiveStats while racing. The server's numbers in `match_result` are
    // the official ones; its result still uses its own WPM formula until the
    // server side is updated.
    errors: state.errors,
    finishedTyping,
    accuracy: state.typed === 0 ? 0 : state.correct / state.typed,
  }
}
