// Adapted from elpddev/typing-test (https://github.com/elpddev/typing-test),
// Copyright Eyal Lapid, licensed under Apache-2.0 (see ../LICENSE-typing-test.txt).
// Modified: word bank passed in instead of imported, KeyCode replaced with
// KeyboardEvent.key, random pick can now return the last item, space mid-word
// counts as a wrong letter, end of board detected, and helper functions
// consolidated.

import { withStatus, type Letter } from './Letter'
import { createWord, replaceLetter, type Word } from './Word'
import type { SuccessStatus } from './SuccessStatus'

/**
 * `words` alternates real words and single-space words:
 * [word, ' ', word, ' ', ..., word]. Real words sit at even indices.
 * `wordIndex === words.length` means every letter has been typed.
 */
export interface Board {
  words: Word[]
  wordIndex: number
  letterIndex: number
}

export const DEFAULT_WORD_COUNT = 200

export function createBoard(bank: string[], count = DEFAULT_WORD_COUNT): Board {
  return { words: generateWords(bank, count), wordIndex: 0, letterIndex: 0 }
}

export function generateWords(bank: string[], count: number): Word[] {
  const words: Word[] = []
  for (let i = 0; i < count; i += 1) {
    if (i > 0) words.push(createWord(' '))
    words.push(createWord(getRandomItem(bank)))
  }
  return words
}

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function isFinished(board: Board): boolean {
  return board.wordIndex >= board.words.length
}

export function getCurrentLetter(board: Board): Letter | undefined {
  return board.words[board.wordIndex]?.letters[board.letterIndex]
}

/**
 * Applies one typed character. Returns the same board instance when the key
 * is ignored, so callers can tell a no-op from a real keystroke.
 */
export function typeChar(board: Board, char: string): Board {
  const current = getCurrentLetter(board)
  if (!current) return board

  // Space at the start of a word is ignored (e.g. a double space). Anywhere
  // else in a word it falls through and counts as a wrong letter.
  if (char === ' ' && current.char !== ' ' && board.letterIndex === 0) {
    return board
  }

  const status: SuccessStatus = current.char === char ? 'success' : 'fail'
  const word = board.words[board.wordIndex]
  const next = replaceWordAt(
    board,
    board.wordIndex,
    replaceLetter(word, board.letterIndex, withStatus(current, status)),
  )

  if (board.letterIndex === word.letters.length - 1) {
    return { ...next, wordIndex: board.wordIndex + 1, letterIndex: 0 }
  }
  return { ...next, letterIndex: board.letterIndex + 1 }
}

export function backspace(board: Board): Board {
  if (board.wordIndex === 0 && board.letterIndex === 0) return board

  let wordIndex = board.wordIndex
  let letterIndex = board.letterIndex

  if (letterIndex > 0) {
    letterIndex -= 1
  } else {
    // Step back onto the last letter of the previous word.
    wordIndex -= 1
    letterIndex = board.words[wordIndex].letters.length - 1
  }

  const word = board.words[wordIndex]
  const reset = replaceLetter(
    word,
    letterIndex,
    withStatus(word.letters[letterIndex], 'initial'),
  )
  return { ...replaceWordAt(board, wordIndex, reset), wordIndex, letterIndex }
}

export function countLetters(board: Board, status: SuccessStatus): number {
  let total = 0
  for (const word of board.words) {
    for (const letter of word.letters) {
      if (letter.status === status) total += 1
    }
  }
  return total
}

function replaceWordAt(board: Board, index: number, word: Word): Board {
  const words = [...board.words]
  words[index] = word
  return { ...board, words }
}
