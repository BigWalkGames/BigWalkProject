import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref, type RefObject } from 'react'
import type { Board } from '../models/Board'
import type { Word } from '../models/Word'
import { CARET_SLIDE_MS, LINE_SLIDE_MS, useTypingSettings } from '../typingSettings'

/** How long after the last keystroke the cursor starts blinking. */
const CARET_IDLE_MS = 500

/**
 * Word groups rendered from the first visible line on. Only the lines near
 * the cursor are on the page (not all ~200 words), so each change lays out a
 * few dozen words. 60 groups fill well over three lines at any box width.
 */
const RENDER_AHEAD_GROUPS = 60

/** Groups brought back at once when backspacing above the rendered lines. */
const RENDER_BACK_GROUPS = 20

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

/** Scrolls the words layer so `offset` px of it are above the visible box. */
function setOffset(layer: HTMLElement, offset: number) {
  layer.style.transform = offset === 0 ? '' : `translateY(${-offset}px)`
}

/** Where the layer is drawn right now, mid-slide included. */
function visibleOffset(layer: HTMLElement): number {
  const transform = getComputedStyle(layer).transform
  return transform === 'none' ? 0 : -new DOMMatrix(transform).m42
}

/** The first rendered group at or below `top` (a line start), with its top. */
function groupAt(layer: HTMLElement, top: number): { group: number; top: number } | null {
  for (const el of layer.querySelectorAll<HTMLElement>('.tt-word')) {
    if (el.offsetTop >= top - 1) return { group: Number(el.dataset.group), top: el.offsetTop }
  }
  return null
}

/**
 * Renders the board. Each real word is grouped with the space after it so
 * lines never start with a space. The current line is kept as the second
 * visible line by moving the inner `.tt-words__lines` layer up (a short slide
 * of our own, so it looks the same in every browser). Once a slide ends, the
 * lines that went out of view are removed and the layer moves back by their
 * height, so only the lines near the cursor stay on the page.
 */
export function WordsDisplay({ board, showCursor }: { board: Board; showCursor: boolean }) {
  const { caretSpeed, smoothLines } = useTypingSettings()
  const layerRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLSpanElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const caretTopRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | undefined>(undefined)

  // The rendered window starts at `firstGroup`, reset for each new board.
  const boardId = board.words[0]?.id ?? ''
  const [windowStart, setWindowStart] = useState({ boardId, group: 0 })
  const firstGroup = windowStart.boardId === boardId ? windowStart.group : 0
  // Bumped to lay out again after a line slide ends or the box is resized.
  const [layoutTick, setLayoutTick] = useState(0)

  // How far the layer is scrolled up, and the slide moving it, if any.
  const offsetRef = useRef(0)
  const lineAnimRef = useRef<Animation | null>(null)
  // Height of the lines being removed, taken off the offset once they're gone.
  const removedPxRef = useRef(0)
  const lastBoardIdRef = useRef(boardId)
  const lastFirstGroupRef = useRef(firstGroup)

  const currentGroup = Math.floor(board.wordIndex / 2)
  const groupCount = Math.ceil(board.words.length / 2)
  const lastGroup = Math.min(
    groupCount,
    Math.max(firstGroup + RENDER_AHEAD_GROUPS, currentGroup + RENDER_BACK_GROUPS),
  )

  // Line scrolling and the cursor, measured before paint so a removed line
  // and the layer moving back show up in the same frame.
  useLayoutEffect(() => {
    const layer = layerRef.current
    const caret = caretRef.current
    if (!layer || !caret) return

    const stopSlide = () => {
      lineAnimRef.current?.cancel()
      lineAnimRef.current = null
    }

    const newBoard = lastBoardIdRef.current !== boardId
    if (newBoard) {
      lastBoardIdRef.current = boardId
      stopSlide()
      offsetRef.current = 0
      removedPxRef.current = 0
      setOffset(layer, 0)
    }
    if (removedPxRef.current) {
      offsetRef.current -= removedPxRef.current
      removedPxRef.current = 0
      setOffset(layer, offsetRef.current)
    }
    const windowMoved = lastFirstGroupRef.current !== firstGroup
    lastFirstGroupRef.current = firstGroup

    const showEarlierLines = () => {
      stopSlide()
      setWindowStart({ boardId, group: Math.max(0, Math.min(currentGroup, firstGroup) - RENDER_BACK_GROUPS) })
    }

    const current = currentRef.current
    if (currentGroup < firstGroup) return showEarlierLines()
    if (current) {
      const lineHeight = current.offsetHeight
      const top = current.offsetTop
      // Backspaced onto the first rendered line: bring the lines above back.
      if (top < lineHeight / 2 && firstGroup > 0) return showEarlierLines()

      const target = Math.max(0, top - lineHeight)
      if (target !== offsetRef.current) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (target > offsetRef.current && smoothLines && !reduceMotion && !windowMoved) {
          const from = visibleOffset(layer)
          stopSlide()
          offsetRef.current = target
          setOffset(layer, target)
          const anim = layer.animate(
            [{ transform: `translateY(${-from}px)` }, { transform: `translateY(${-target}px)` }],
            { duration: LINE_SLIDE_MS, easing: 'ease-out' },
          )
          lineAnimRef.current = anim
          anim.onfinish = () => {
            if (lineAnimRef.current !== anim) return
            lineAnimRef.current = null
            setLayoutTick((tick) => tick + 1)
          }
        } else {
          stopSlide()
          offsetRef.current = target
          setOffset(layer, target)
        }
      }

      // Not sliding: remove the lines scrolled out of view.
      if (!lineAnimRef.current && offsetRef.current > 0) {
        const start = groupAt(layer, offsetRef.current)
        if (start && start.group !== firstGroup) {
          removedPxRef.current = start.top
          setWindowStart({ boardId, group: start.group })
          return
        }
      }
    }

    placeCaret(layer, caret, caretTopRef, caretSpeed !== 'off' && !newBoard && !windowMoved)

    caret.classList.add('is-typing')
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(
      () => caret.classList.remove('is-typing'),
      CARET_IDLE_MS,
    )
  }, [board, showCursor, boardId, firstGroup, currentGroup, layoutTick, smoothLines, caretSpeed])

  // Lay out again without sliding if the box is resized (text reflows).
  // Created once, not on every keystroke.
  useEffect(() => {
    const viewport = layerRef.current?.parentElement
    if (!viewport) return
    const observer = new ResizeObserver(() => {
      lineAnimRef.current?.cancel()
      lineAnimRef.current = null
      caretTopRef.current = null
      setLayoutTick((tick) => tick + 1)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => window.clearTimeout(idleTimerRef.current), [])

  const groups: [Word, Word | undefined, number][] = []
  for (let g = firstGroup; g < lastGroup; g += 1) {
    groups.push([board.words[g * 2], board.words[g * 2 + 1], g])
  }

  const cursorFor = (wordIndex: number) =>
    showCursor && wordIndex === board.wordIndex ? board.letterIndex : -1

  const style = { '--tt-caret-ms': `${CARET_SLIDE_MS[caretSpeed]}ms` } as CSSProperties

  return (
    <div className="tt-words" style={style}>
      <div className="tt-words__scroll">
        <div className="tt-words__lines" ref={layerRef}>
          <span className="tt-caret" ref={caretRef} aria-hidden="true" />
          {groups.map(([word, space, g]) => (
            <WordGroup
              key={word.id}
              group={g}
              word={word}
              space={space}
              wordCursor={cursorFor(g * 2)}
              spaceCursor={cursorFor(g * 2 + 1)}
              groupRef={g === currentGroup ? currentRef : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * One word plus the space after it. Memoized, so a keystroke only re-renders
 * the words whose letters or cursor changed, not every word on the page.
 * Words are immutable (the board copies only what changes), so an unchanged
 * word keeps the same object and is skipped.
 */
const WordGroup = memo(function WordGroup({
  group,
  word,
  space,
  wordCursor,
  spaceCursor,
  groupRef,
}: {
  group: number
  word: Word
  space: Word | undefined
  wordCursor: number
  spaceCursor: number
  groupRef: Ref<HTMLSpanElement> | undefined
}) {
  return (
    <span className="tt-word" data-group={group} ref={groupRef}>
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
