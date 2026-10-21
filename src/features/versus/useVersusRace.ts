import { useEffect, useReducer, useRef, useState } from 'react'
import { sendProgress } from '../../net/quickMatch'
import { backspace, countLetters, getCurrentLetter, typeChar, type Board } from '../typing/models/Board'
import { computeWpm } from '../typing/stats/computeStats'
import type { Keystroke } from '../typing/stats/types'
import { boardFromWords } from './boardFromWords'

/** Roughly 10 updates a second. The server disconnects clients that send more than 30. */
const PROGRESS_INTERVAL_MS = 100

interface State {
  board: Board
  /** Every forward key press, including wrong ones. Backspace does not undo it. */
  typed: number
  /** Key presses that matched the expected letter. */
  correct: number
  /** The same forward key presses, in order. Used for the per-key table on the results screen. */
  keystrokes: Keystroke[]
}

type Action = { type: 'key'; key: string; t: number }

/** One letter per completed real word: 'g' if it has no wrong letters, 'r' if it has. */
function wordResults(board: Board): string {
  let out = ''
  for (let i = 0; i < board.wordIndex && i < board.words.length; i += 2) {
    out += board.words[i].letters.some((letter) => letter.status === 'fail') ? 'r' : 'g'
  }
  return out
}

function reducer(state: State, action: Action): State {
  if (action.key === 'Backspace') {
    const board = backspace(state.board)
    return board === state.board ? state : { ...state, board }
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
    keystrokes: [...state.keystrokes, { expected, typed, correct: expected === typed, t: action.t }],
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
    keystrokes: [],
  }))

  // Local clock, only for the on-screen timer. The server's clock decides the race.
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!racing) return
    const id = setInterval(() => setNow(Date.now()), PROGRESS_INTERVAL_MS)
    return () => clearInterval(id)
  }, [racing])

  const elapsedMs = racing && startedAt !== null && now > 0 ? Math.max(0, now - startedAt) : 0
  const timeLeftMs = Math.max(0, durationMs - elapsedMs)
  const timeIsUp = timeLeftMs <= 0

  // Accept keys only while the race is on.
  const acceptingInput = racing && !timeIsUp
  useEffect(() => {
    if (!acceptingInput) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key !== 'Backspace' && event.key.length !== 1) return
      event.preventDefault()
      dispatch({ type: 'key', key: event.key, t: Math.max(0, Date.now() - (startedAt ?? Date.now())) })
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [acceptingInput, startedAt])

  // Send the running totals while racing, only when they changed.
  const latest = useRef({ typed: 0, correct: 0, wordResults: '' })
  const lastSent = useRef({ typed: -1, correct: -1, wordResults: '' })
  useEffect(() => {
    latest.current = { typed: state.typed, correct: state.correct, wordResults: wordResults(state.board) }
  }, [state.typed, state.correct, state.board])
  useEffect(() => {
    if (!racing) return
    const id = setInterval(() => {
      const { typed, correct, wordResults } = latest.current
      const sent = lastSent.current
      if (typed === sent.typed && correct === sent.correct && wordResults === sent.wordResults) return
      lastSent.current = { typed, correct, wordResults }
      sendProgress(typed, correct, wordResults)
    }, PROGRESS_INTERVAL_MS)
    return () => clearInterval(id)
  }, [racing])

  return {
    board: state.board,
    typed: state.typed,
    correct: state.correct,
    keystrokes: state.keystrokes,
    timeLeftMs,
    // Live numbers for the stats bar. The server's numbers in `match_result` are the official ones.
    wpm: computeWpm(countLetters(state.board, 'success'), elapsedMs),
    accuracy: state.typed === 0 ? 0 : state.correct / state.typed,
  }
}
