import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  backspace,
  createBoard,
  getCurrentLetter,
  isFinished,
  typeChar,
  type Board,
} from './models/Board'
import { computeResult } from './stats/computeStats'
import type { Keystroke, TestResult } from './stats/types'
import { loadWordBank } from './wordbank/loadWordBank'
import type { WordBankSourceName } from './wordbank/types'
import { BACKSPACE, type Keystroke as EngineKeystroke } from '../word-engine'
import { debugEngineLog } from '../../tests/wordEngineDebug'
import { recordMatch } from './player/playerStore'
import { useFrameKeys, type QueuedKey } from './useFrameKeys'

export type TestStatus = 'loading' | 'idle' | 'running' | 'finished'

interface State {
  status: TestStatus
  durationMs: number
  board: Board | null
  source: WordBankSourceName | null
  keystrokes: Keystroke[]
  startedAt: number | null
  endedAt: number | null
  engineLog: EngineKeystroke[]
  lastKeyTs: number | null
  /**
   * Running totals, updated per key so the live stats don't rescan the board
   * and keystroke log on every render: keystrokes that were right, and letters
   * on the board still marked wrong (backspacing over one lowers it).
   */
  correctCount: number
  failCount: number
}

type Action =
  | { type: 'loading' }
  | { type: 'loaded'; board: Board; source: WordBankSourceName; durationMs: number }
  | { type: 'keys'; keys: QueuedKey[] }
  | { type: 'finish'; at: number }

/** Maps a board position to the engine's (wordIndex, charIndex). */
function enginePosition(board: Board) {
  const i = board.wordIndex
  if (i % 2 === 0) return { wordIndex: i / 2, charIndex: board.letterIndex }
  return { wordIndex: (i - 1) / 2, charIndex: board.words[i - 1].letters.length }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading' }

    case 'loaded':
      return {
        status: 'idle',
        durationMs: action.durationMs,
        board: action.board,
        source: action.source,
        keystrokes: [],
        startedAt: null,
        endedAt: null,
        engineLog: [],
        lastKeyTs: null,
        correctCount: 0,
        failCount: 0,
      }

    case 'finish':
      if (state.status !== 'running') return state
      return { ...state, status: 'finished', endedAt: action.at }

    case 'keys':
      return action.keys.reduce(applyKey, state)
  }
}

/** One key press, in the order they were typed. */
function applyKey(state: State, action: QueuedKey): State {
  const { board } = state
  if (!board || (state.status !== 'idle' && state.status !== 'running')) return state

  // The timer starts on the first key press.
  const startedAt = state.startedAt ?? action.at
  const deadline = startedAt + state.durationMs
  if (action.at >= deadline) {
    return { ...state, status: 'finished', endedAt: deadline }
  }

  const latencyMs = state.lastKeyTs === null ? 0 : action.ts - state.lastKeyTs

  if (action.key === 'Backspace') {
    const next = backspace(board)
    if (next === board) return state
    const erased = board.words[next.wordIndex].letters[next.letterIndex]
    const entry: EngineKeystroke = {
      expected: erased.char,
      typed: BACKSPACE,
      latencyMs,
      ...enginePosition(next),
    }
    return {
      ...state,
      board: next,
      engineLog: [...state.engineLog, entry],
      lastKeyTs: action.ts,
      failCount: state.failCount - (erased.status === 'fail' ? 1 : 0),
    }
  }

  // Case-insensitive: word banks are lowercase, so lowercase the key too.
  const typed = action.key.toLowerCase()
  const expected = getCurrentLetter(board)?.char
  const next = typeChar(board, typed)
  if (expected === undefined || next === board) return state

  const keystroke: Keystroke = {
    expected,
    typed,
    correct: expected === typed,
    t: action.at - startedAt,
    wordIndex: board.wordIndex,
    letterIndex: board.letterIndex,
  }
  const entry: EngineKeystroke = { expected, typed, latencyMs, ...enginePosition(board) }
  const done = isFinished(next)
  return {
    ...state,
    board: next,
    keystrokes: [...state.keystrokes, keystroke],
    status: done ? 'finished' : 'running',
    startedAt,
    endedAt: done ? action.at : null,
    engineLog: [...state.engineLog, entry],
    lastKeyTs: action.ts,
    correctCount: state.correctCount + (keystroke.correct ? 1 : 0),
    failCount: state.failCount + (keystroke.correct ? 0 : 1),
  }
}

function initState(durationMs: number): State {
  return {
    status: 'loading',
    durationMs,
    board: null,
    source: null,
    keystrokes: [],
    startedAt: null,
    endedAt: null,
    engineLog: [],
    lastKeyTs: null,
    correctCount: 0,
    failCount: 0,
  }
}

/**
 * A timed typing test. Loads words (Supabase, else fallback), captures
 * keystrokes from the whole document, starts the clock on the first key, and
 * produces a TestResult when time runs out or every word is typed.
*/
export function useTypingTest(durationMs: number) {
  const [state, dispatch] = useReducer(reducer, durationMs, initState)
  const loadRequest = useRef(0)
  
  // Each load retries Supabase; only the newest request is applied.
  const load = useCallback(() => {
    const request = ++loadRequest.current
    void loadWordBank().then(({ words, source }) => {
      if (request !== loadRequest.current) return
      dispatch({ type: 'loaded', board: createBoard(words), source, durationMs })
    })
  }, [durationMs])
  
  useEffect(() => {
    load()
  }, [load])
  
  // TEMP: only for verifying keysroke log
  useEffect(() => {
    if (import.meta.env.DEV && state.status === 'finished') debugEngineLog(state.engineLog)
    }, [state.status, state.engineLog])
  
  const restart = useCallback(() => {
    dispatch({ type: 'loading' })
    load()
  }, [load])
  
  const acceptingInput = state.status === 'idle' || state.status === 'running'
  const flushKeys = useFrameKeys(acceptingInput, (keys) => dispatch({ type: 'keys', keys }))

  // Ends the test when time runs out. One timer for the deadline, not a
  // ticking clock: the on-screen countdown ticks inside LiveStats, so clock
  // ticks don't re-render the whole test (and the word box) 10 times a second.
  // Keys still waiting for the next frame are applied first.
  const { status, startedAt } = state
  useEffect(() => {
    if (status !== 'running' || startedAt === null) return
    const deadline = startedAt + state.durationMs
    const id = setTimeout(
      () => {
        flushKeys()
        dispatch({ type: 'finish', at: deadline })
      },
      Math.max(0, deadline - Date.now()),
    )
    return () => clearTimeout(id)
  }, [status, startedAt, state.durationMs, flushKeys])

  const result = useMemo<TestResult | null>(() => {
    if (state.status !== 'finished' || !state.board || !state.source) return null
    if (state.startedAt === null || state.endedAt === null) return null
    return computeResult({
      board: state.board,
      keystrokes: state.keystrokes,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      source: state.source,
    })
  }, [state])
  
  useEffect(() => {
    if (!result) return
    // Deferred so the stats update and save run after the
    // results screen paints. Not cancelled on cleanup: the save must still
    // happen if this component unmounts for the results screen.
    const log = state.engineLog
    setTimeout(() => void recordMatch(log, result.wpm, result.accuracy), 0)
  }, [result, state.engineLog])
  
  return {
    status: state.status,
    board: state.board,
    wordBankSource: state.source,
    // For LiveStats, which works out the time left, WPM and accuracy.
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    durationMs: state.durationMs,
    keystrokeCount: state.keystrokes.length,
    correctCount: state.correctCount,
    failCount: state.failCount,
    result,
    restart,
  }
}
