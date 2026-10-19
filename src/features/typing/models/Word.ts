// Adapted from elpddev/typing-test (https://github.com/elpddev/typing-test),
// Copyright Eyal Lapid, licensed under Apache-2.0 (see ../LICENSE-typing-test.txt).
// Modified: uuid replaced with crypto.randomUUID, ids kept stable across
// updates, unused status/display fields removed.

import { createLetter, type Letter } from './Letter'

export interface Word {
  letters: Letter[]
  id: string
}

export function createWord(text: string): Word {
  return {
    letters: Array.from(text, createLetter),
    id: crypto.randomUUID(),
  }
}

export function replaceLetter(word: Word, index: number, letter: Letter): Word {
  const letters = [...word.letters]
  letters[index] = letter
  return { ...word, letters }
}
