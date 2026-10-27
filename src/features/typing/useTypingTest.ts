import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  backspace,
  countLetters,
  createBoard,
  getCurrentLetter,
  isFinished,
  typeChar,
  type Board,
} from './models/Board'
import { computeAccuracy, computeNetWpm, computeResult } from './stats/computeStats'
import type { Keystroke, TestResult } from './stats/types'
import { loadWordBank } from './wordbank/loadWordBank'
import type { WordBankSourceName } from './wordbank/types'
import { BACKSPACE, type Keystroke as EngineKeystroke } from '../word-engine'
import { debugEngineLog } from '../../tests/wordEngineDebug'
import { recordMatch } from './player/playerStore'

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
}

type Action =
  | { type: 'loading' }
  | { type: 'loaded'; board: Board; source: WordBankSourceName; durationMs: number }
  | { type: 'key'; key: string; at: number; ts: number }
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
        lastKeyTs: null
      }

    case 'finish':
      if (state.status !== 'running') return state
      return { ...state, status: 'finished', endedAt: action.at }

    case 'key': {
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
        const erased = next.words[next.wordIndex].letters[next.letterIndex].char
        const entry: EngineKeystroke = {
          expected: erased,
          typed: BACKSPACE,
          latencyMs,
          ...enginePosition(next),
        }
        return {
          ...state,
          board: next,
          engineLog: [...state.engineLog, entry],
          lastKeyTs: action.ts,
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
      }
    }
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
    lastKeyTs: null
  }
}

/**
 * A timed typing test. Loads words (Supabase, else fallback), captures
 * keystrokes from the whole document, starts the clock on the first key, and
 * produces a TestResult when time runs out or every word is typed.
*/
export function useTypingTest(durationMs: number) {
  const [state, dispatch] = useReducer(reducer, durationMs, initState)
  const [now, setNow] = useState(0)
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
    if (state.status === 'finished') debugEngineLog(state.engineLog)
    }, [state.status, state.engineLog])
  
  const restart = useCallback(() => {
    dispatch({ type: 'loading' })
    load()
  }, [load])
  
  const acceptingInput = state.status === 'idle' || state.status === 'running'
  useEffect(() => {
    if (!acceptingInput) return
    
    function onKeyDown(event: KeyboardEvent) {
      // Auto-repeat is ignored so keys still held from the menu (F+J, Q)
      // don't type into the test.
      if (event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key !== 'Backspace' && event.key.length !== 1) return
      event.preventDefault()
      dispatch({ type: 'key', key: event.key, at: Date.now(), ts: performance.now() })
    }
    
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [acceptingInput])
  
  const { status, startedAt } = state
  useEffect(() => {
    if (status !== 'running' || startedAt === null) return
    
    const id = setInterval(() => {
      const t = Date.now()
      if (t - startedAt >= state.durationMs) {
        dispatch({ type: 'finish', at: startedAt + state.durationMs })
      } else {
        setNow(t)
      }
    }, 100)
    return () => clearInterval(id)
  }, [status, startedAt, state.durationMs])
  
  let elapsedMs = 0
  if (startedAt !== null) {
    const end = state.endedAt ?? now
    elapsedMs = Math.min(Math.max(0, end - startedAt), state.durationMs)
  }
  
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
    if (result) void recordMatch(state.engineLog, result.wpm, result.accuracy)
  }, [result, state.engineLog])
  
  return {
    status: state.status,
    board: state.board,
    wordBankSource: state.source,
    timeLeftMs: state.durationMs - elapsedMs,
    // Same Net WPM formula as the final result, so the live number matches it.
    wpm: state.board
      ? computeNetWpm(state.keystrokes.length, countLetters(state.board, 'fail'), elapsedMs)
      : 0,
    accuracy: computeAccuracy(state.keystrokes),
    keystrokeCount: state.keystrokes.length,
    result,
    restart,
  }
}
