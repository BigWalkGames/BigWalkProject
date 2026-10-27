import { memo, useEffect, useLayoutEffect, useRef, type Ref, type RefObject } from 'react'
import type { Board } from '../models/Board'
import type { Word } from '../models/Word'

/** How long after the last keystroke the cursor starts blinking. */
const CARET_IDLE_MS = 500

/**
 * Moves the cursor to the current letter (.tt-letter.is-cursor). It slides
 * via the CSS transition, except when `animate` is false or the line changed,
 * where it jumps. `lastTop` remembers the line between calls.
 */
function placeCaret(
  container: HTMLElement,
  caret: HTMLElement,
  lastTop: RefObject<number | null>,
  animate: boolean,
) {
  const letter = container.querySelector<HTMLElement>('.tt-letter.is-cursor')
  if (!letter) {
    caret.hidden = true
    lastTop.current = null
    return
  }
  caret.hidden = false
  const top = letter.offsetTop
  const jump = !animate || (lastTop.current !== null && lastTop.current !== top)
  lastTop.current = top

  if (jump) caret.style.transition = 'none'
  caret.style.transform = `translate(${letter.offsetLeft}px, ${top}px)`
  if (jump) {
    void caret.offsetWidth // apply the jump before turning the slide back on
    caret.style.transition = ''
  }
}

/**
 * Renders the board. Each real word is grouped with the space after it so
 * lines never start with a space. The current line is kept as the second
 * visible line by scrolling the inner `.tt-words__scroll` layer (the outer
 * box only draws the frame and padding).
 */
export function WordsDisplay({ board, showCursor }: { board: Board; showCursor: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLSpanElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const caretTopRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | undefined>(undefined)
  const currentGroup = Math.floor(board.wordIndex / 2)

  // Scroll so the current line is the second visible line.
  useEffect(() => {
    const container = containerRef.current
    const current = currentRef.current
    if (!container || !current) return
    const top = Math.max(0, current.offsetTop - current.offsetHeight)
    container.scrollTo({ top, behavior: 'smooth' })
  }, [currentGroup])

  // One cursor for the whole box: it slides to the current letter, and stays
  // solid while typing, blinking only after CARET_IDLE_MS without input.
  useLayoutEffect(() => {
    const container = containerRef.current
    const caret = caretRef.current
    if (!container || !caret) return

    placeCaret(container, caret, caretTopRef, caretTopRef.current !== null)

    caret.classList.add('is-typing')
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(
      () => caret.classList.remove('is-typing'),
      CARET_IDLE_MS,
    )
  }, [board, showCursor])

  // Re-place without sliding if the box is resized (text reflows). Created
  // once, not on every keystroke.
  useEffect(() => {
    const container = containerRef.current
    const caret = caretRef.current
    if (!container || !caret) return
    const observer = new ResizeObserver(() => placeCaret(container, caret, caretTopRef, false))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => window.clearTimeout(idleTimerRef.current), [])

  const groups: [Word, Word | undefined][] = []
  for (let i = 0; i < board.words.length; i += 2) {
    groups.push([board.words[i], board.words[i + 1]])
  }

  const cursorFor = (wordIndex: number) =>
    showCursor && wordIndex === board.wordIndex ? board.letterIndex : -1

  return (
    <div className="tt-words">
      <div className="tt-words__scroll" ref={containerRef}>
        <span className="tt-caret" ref={caretRef} aria-hidden="true" />
        {groups.map(([word, space], g) => (
          <WordGroup
            key={word.id}
            word={word}
            space={space}
            wordCursor={cursorFor(g * 2)}
            spaceCursor={cursorFor(g * 2 + 1)}
            groupRef={g === currentGroup ? currentRef : undefined}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * One word plus the space after it. Memoized, so a keystroke only re-renders
 * the words whose letters or cursor changed, not all ~200 on the board.
 * Words are immutable (the board copies only what changes), so an unchanged
 * word keeps the same object and is skipped.
 */
const WordGroup = memo(function WordGroup({
  word,
  space,
  wordCursor,
  spaceCursor,
  groupRef,
}: {
  word: Word
  space: Word | undefined
  wordCursor: number
  spaceCursor: number
  groupRef: Ref<HTMLSpanElement> | undefined
}) {
  return (
    <span className="tt-word" ref={groupRef}>
      <WordLetters word={word} cursor={wordCursor} />
      {space && <WordLetters word={space} cursor={spaceCursor} />}
    </span>
  )
})

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
