import type { Board } from '../typing/models/Board'
import { createWord, type Word } from '../typing/models/Word'

/**
 * Builds a typing board from an exact word list, for example the one the server
 * sends in `match_found`. Both players call this with the same list, so both see
 * the same words in the same order.
 *
 * It uses the same layout as the Time Attack board (real words at even indexes,
 * single spaces between them), so the Time Attack WordsDisplay works unchanged.
 */
export function boardFromWords(words: string[]): Board {
  const list: Word[] = []
  words.forEach((word, i) => {
    if (i > 0) list.push(createWord(' '))
    list.push(createWord(word))
  })
  return { words: list, wordIndex: 0, letterIndex: 0 }
}
