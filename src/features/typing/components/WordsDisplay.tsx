import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Board } from '../models/Board'
import type { Word } from '../models/Word'

/** How long after the last keystroke the cursor starts blinking. */
const CARET_IDLE_MS = 500

/**
 * Renders the board. Each real word is grouped with the space after it so
 * lines never start with a space. The current line is kept as the second
 * visible line.
 */
export function WordsDisplay({ board, showCursor }: { board: Board; showCursor: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLSpanElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const caretTopRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | undefined>(undefined)
  const currentGroup = Math.floor(board.wordIndex / 2)

  useEffect(() => {
    const container = containerRef.current
    const current = currentRef.current
    if (!container || !current) return
    const top = Math.max(0, current.offsetTop - current.offsetHeight)
    container.scrollTo({ top, behavior: 'smooth' })
  }, [currentGroup])

  // One cursor for the whole box: it slides to the current letter (CSS
  // transition), jumps without sliding when the line changes, and stays solid
  // while typing, blinking only after CARET_IDLE_MS without input.
  useLayoutEffect(() => {
    const container = containerRef.current
    const caret = caretRef.current
    if (!container || !caret) return

    const place = (animate: boolean) => {
      const letter = container.querySelector<HTMLElement>('.tt-letter.is-cursor')
      if (!letter) {
        caret.hidden = true
        caretTopRef.current = null
        return
      }
      caret.hidden = false
      const top = letter.offsetTop
      const lineChanged = caretTopRef.current !== null && caretTopRef.current !== top
      caretTopRef.current = top

      if (!animate || lineChanged) caret.style.transition = 'none'
      caret.style.transform = `translate(${letter.offsetLeft}px, ${top}px)`
      if (!animate || lineChanged) {
        void caret.offsetWidth // apply the jump before turning the slide back on
        caret.style.transition = ''
      }
    }

    place(caretTopRef.current !== null)

    caret.classList.add('is-typing')
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(
      () => caret.classList.remove('is-typing'),
      CARET_IDLE_MS,
    )

    // Re-place without sliding if the box is resized (text reflows).
    const observer = new ResizeObserver(() => place(false))
    observer.observe(container)
    return () => observer.disconnect()
  }, [board, showCursor])

  useEffect(() => () => window.clearTimeout(idleTimerRef.current), [])

  const groups: [Word, Word | undefined][] = []
  for (let i = 0; i < board.words.length; i += 2) {
    groups.push([board.words[i], board.words[i + 1]])
  }

  const cursorFor = (wordIndex: number) =>
    showCursor && wordIndex === board.wordIndex ? board.letterIndex : -1

  return (
    <div className="tt-words" ref={containerRef}>
      <span className="tt-caret" ref={caretRef} aria-hidden="true" />
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

export function WordLetters({ word, cursor = -1 }: { word: Word; cursor?: number }) {
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
