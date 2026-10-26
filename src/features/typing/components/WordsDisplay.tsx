import { useEffect, useRef } from 'react'
import type { Board } from '../models/Board'
import type { Word } from '../models/Word'

/**
 * Renders the board. Each real word is grouped with the space after it so
 * lines never start with a space. The current line is kept as the second
 * visible line.
 *
 * The outer box clips (`overflow: clip` in typing.css) and cannot be scrolled,
 * so the words sit in an inner wrapper that is moved up with a transform.
 */
export function WordsDisplay({ board, showCursor }: { board: Board; showCursor: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const linesRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLSpanElement>(null)
  const currentGroup = Math.floor(board.wordIndex / 2)

  // Move the words so the current line is the second visible line.
  useEffect(() => {
    const lines = linesRef.current
    const container = containerRef.current
    if (!lines || !container) return

    const place = () => {
      const current = currentRef.current
      if (!current) return
      const top = Math.max(0, current.offsetTop - current.offsetHeight)
      lines.style.transform = `translateY(${-top}px)`
    }
    place()

    // Lines wrap differently when the window is resized, so place them again.
    const observer = new ResizeObserver(place)
    observer.observe(container)
    return () => observer.disconnect()
  }, [currentGroup])

  const groups: [Word, Word | undefined][] = []
  for (let i = 0; i < board.words.length; i += 2) {
    groups.push([board.words[i], board.words[i + 1]])
  }

  const cursorFor = (wordIndex: number) =>
    showCursor && wordIndex === board.wordIndex ? board.letterIndex : -1

  return (
    <div className="tt-words" ref={containerRef}>
      <div className="tt-words__lines" ref={linesRef}>
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
