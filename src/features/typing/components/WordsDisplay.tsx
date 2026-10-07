import { useEffect, useRef } from 'react'
import type { Board } from '../models/Board'
import type { Word } from '../models/Word'

/**
 * Renders the board. Each real word is grouped with the space after it so
 * lines never start with a space. The current line is kept as the second
 * visible line.
 */
export function WordsDisplay({ board, showCursor }: { board: Board; showCursor: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLSpanElement>(null)
  const currentGroup = Math.floor(board.wordIndex / 2)

  useEffect(() => {
    const container = containerRef.current
    const current = currentRef.current
    if (!container || !current) return
    const top = Math.max(0, current.offsetTop - current.offsetHeight)
    container.scrollTo({ top, behavior: 'smooth' })
  }, [currentGroup])

  const groups: [Word, Word | undefined][] = []
  for (let i = 0; i < board.words.length; i += 2) {
    groups.push([board.words[i], board.words[i + 1]])
  }

  const cursorFor = (wordIndex: number) =>
    showCursor && wordIndex === board.wordIndex ? board.letterIndex : -1

  return (
    <div className="tt-words" ref={containerRef}>
      {groups.map(([word, space], g) => (
        <span
          key={word.id}
          className="tt-word"
          ref={g === currentGroup ? currentRef : undefined}
        >
          <WordLetters word={word} cursor={cursorFor(g * 2)} />
          {space && <WordLetters word={space} cursor={cursorFor(g * 2 + 1)} />}
        </span>
      ))}
    </div>
  )
}

function WordLetters({ word, cursor }: { word: Word; cursor: number }) {
  return word.letters.map((letter, i) => (
    <span
      key={letter.id}
      className={[
        'tt-letter',
        `is-${letter.status}`,
        letter.char === ' ' && 'is-space',
        i === cursor && 'is-cursor',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {letter.char}
    </span>
  ))
}
