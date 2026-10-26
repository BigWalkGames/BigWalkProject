import { useEffect, type ReactNode } from 'react'
import { KeyboardHeatmap } from '../heatmap/KeyboardHeatmap'
import type { Board } from '../models/Board'
import type { Word } from '../models/Word'
import type { BigramStats, TestResult } from '../stats/types'
import { displayKey, formatPercent } from './format'
import { Stat } from './StatsBar'
import { WordLetters } from './WordsDisplay'
import { NavButton } from '../../../components/NavButton/NavButton'
import './typing.css'

export type SaveStatus = 'saving' | 'saved' | 'error'

const SAVE_LABEL: Record<SaveStatus, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't save result",
}

/** Untyped words shown after the last typed one in the Word Bank box. */
const UPCOMING_WORDS = 10

/** Shortcuts are ignored this long after the panel opens, so a key pressed
 * as the timer runs out can't trigger Menu or Restart. */
const HOTKEY_DELAY_MS = 700

/**
 * The results layout: bigrams, key accuracies, word bank, stats and the
 * keyboard heatmap. Used by the Time Attack results route and by Versus.
 * Optional parts are hidden when their prop is missing: the Word Bank box
 * without `board`, and the Menu / Restart buttons (Shift+E / Shift+R)
 * without `onMenu` / `onRestart`.
 */
export function ResultsPanel({
  result,
  board,
  saveStatus,
  onRestart,
  onMenu,
}: {
  result: TestResult
  board?: Board
  saveStatus: SaveStatus
  onRestart?: () => void
  onMenu?: () => void
}) {
  useEffect(() => {
    if (!onRestart && !onMenu) return
    const readyAt = Date.now() + HOTKEY_DELAY_MS

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || !event.shiftKey || Date.now() < readyAt) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const action = { r: onRestart, e: onMenu }[event.key.toLowerCase()]
      if (!action) return
      event.preventDefault()
      action()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onRestart, onMenu])

  return (
    <div className="tt is-finished">
      <section className="tt-results" aria-label="Results">
        <div className="tt-results__col">
          <Box title="Bigrams" className="tt-box--bigrams">
            <BigramLists bigrams={result.bigrams} />
          </Box>

          <Box title="Key Accuracies" className="tt-box--keys">
            <KeyAccuracies perKey={result.perKey} />
          </Box>

          {(onMenu || onRestart) && (
            <div className="tt-results__actions">
              {onMenu && (
                <NavButton hotkey={['Sh', 'E']} onClick={onMenu}>
                  Menu
                </NavButton>
              )}
              {onRestart && (
                <NavButton
                  hotkey={['Sh', 'R']}
                  onClick={() => {
                    ;(document.activeElement as HTMLElement | null)?.blur()
                    onRestart()
                  }}
                >
                  Restart
                </NavButton>
              )}
            </div>
          )}
        </div>

        <div className="tt-results__col">
          {board && (
            <Box title="Word Bank" className="tt-box--words">
              <WordReview board={board} />
            </Box>
          )}

          <div className="tt-results__summary">
            <Stat className="tt-stat--hero" label="WPM" value={Math.round(result.wpm).toString()} />
            <Stat label="Accuracy" value={formatPercent(result.accuracy)} />
            <Stat
              label="Bigram Latency"
              value={result.bigramLatencyMs === null ? '—' : `${Math.round(result.bigramLatencyMs)}ms`}
            />
            <p className={`tt-save is-${saveStatus}`}>{SAVE_LABEL[saveStatus]}</p>
          </div>

          <KeyboardHeatmap perKey={result.perKey} />
        </div>
      </section>
    </div>
  )
}

/** A titled box whose content scrolls, so the rest of the screen stays put. */
function Box({ title, className, children }: { title: string; className: string; children: ReactNode }) {
  return (
    <section className={`tt-box ${className}`}>
      <h2 className="tt-box__title">{title}</h2>
      <div className="tt-box__scroll">{children}</div>
    </section>
  )
}

/** How many bigrams each of the Best / Worst lists shows. */
const BIGRAM_LIST_SIZE = 5

/** Lowest accuracy first; ties go to the bigram typed more often. */
function byAccuracyAscending([a, x]: [string, BigramStats], [b, y]: [string, BigramStats]) {
  return x.accuracy - y.accuracy || y.attempts - x.attempts || a.localeCompare(b)
}

function BigramLists({ bigrams }: { bigrams: Record<string, BigramStats> }) {
  const sorted = Object.entries(bigrams).sort(byAccuracyAscending)
  // Worst: the 5 lowest, missed bigrams only. Best: the 5 highest of the
  // rest, so a bigram never shows in both lists. Both read lowest to highest.
  const worst = sorted.filter(([, s]) => s.accuracy < 1).slice(0, BIGRAM_LIST_SIZE)
  const best = sorted.filter((entry) => !worst.includes(entry)).slice(-BIGRAM_LIST_SIZE)

  return (
    <div className="tt-bigrams">
      <BigramColumn heading="Best" items={best} empty="None yet" />
      <BigramColumn heading="Worst" items={worst} empty="No misses" />
    </div>
  )
}

function BigramColumn({
  heading,
  items,
  empty,
}: {
  heading: string
  items: [string, BigramStats][]
  empty: string
}) {
  return (
    <div className="tt-bigrams__col">
      <h3 className="tt-bigrams__heading">{heading}</h3>
      {items.length === 0 ? (
        <p className="tt-muted">{empty}</p>
      ) : (
        <ul className="tt-list">
          {items.map(([pair, stats]) => (
            <li key={pair} title={`${stats.correct} of ${stats.attempts} clean`}>
              <span className="tt-bigrams__pair">
                {pair[0]}, {pair[1]}
              </span>
              <span className="tt-muted">{formatPercent(stats.accuracy)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KeyAccuracies({ perKey }: { perKey: TestResult['perKey'] }) {
  // Lowest accuracy first; ties go to the key typed more often, then A-Z.
  const keys = Object.entries(perKey).sort(
    ([a, x], [b, y]) => x.accuracy - y.accuracy || y.attempts - x.attempts || a.localeCompare(b),
  )
  if (keys.length === 0) return <p className="tt-muted">No keys typed</p>

  return (
    <table className="tt-keys">
      <thead>
        <tr>
          <th scope="col">Key</th>
          <th scope="col">Accuracy</th>
          <th scope="col">Hits</th>
          <th scope="col">Mistyped as</th>
        </tr>
      </thead>
      <tbody>
        {keys.map(([key, stats]) => (
          <tr key={key}>
            <th scope="row" className="tt-key">
              {displayKey(key)}
            </th>
            <td>{formatPercent(stats.accuracy)}</td>
            <td>
              {stats.correct}/{stats.attempts}
            </td>
            <td className="tt-key">{topMistake(stats.mistypedAs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The words from this match, colored as typed, plus a few untyped ones. */
function WordReview({ board }: { board: Board }) {
  const end = Math.min(board.words.length, board.wordIndex + 1 + UPCOMING_WORDS * 2)
  const groups: [Word, Word | undefined][] = []
  for (let i = 0; i < end; i += 2) {
    groups.push([board.words[i], i + 1 < end ? board.words[i + 1] : undefined])
  }

  return (
    <div className="tt-review">
      {groups.map(([word, space]) => (
        <span key={word.id} className="tt-word">
          <WordLetters word={word} />
          {space && <WordLetters word={space} />}
        </span>
      ))}
    </div>
  )
}

function topMistake(mistypedAs: Record<string, number>): string {
  const entries = Object.entries(mistypedAs)
  if (entries.length === 0) return '—'
  const [key, count] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))
  return `${displayKey(key)} (${count}×)`
}
