import { useEffect, useState } from 'react'
import { NavButton } from '../../../components/NavButton/NavButton'
import { consoleStatsSink } from '../stats/consoleStatsSink'
import type { StatsSink, TestResult } from '../stats/types'
import { useTypingTest } from '../useTypingTest'
import { ResultsPanel, type SaveStatus } from './ResultsPanel'
import { StatsBar } from './StatsBar'
import { WordsDisplay } from './WordsDisplay'
import './typing.css'

// Switch to `supabaseStatsSink` (../stats/supabaseStatsSink) once it's finished.
const DEFAULT_STATS_SINK: StatsSink = consoleStatsSink

export function TypingTest({
  durationMs = 60_000,
  statsSink = DEFAULT_STATS_SINK,
}: {
  durationMs?: number
  statsSink?: StatsSink
}) {
  const test = useTypingTest(durationMs)
  const { result, restart } = test

  // Save each finished result once; the status is tied to that result so a
  // restart can't show a stale "Saved".
  const [saved, setSaved] = useState<{ result: TestResult; status: SaveStatus } | null>(null)
  useEffect(() => {
    if (!result) return
    statsSink.saveResult(result).then(
      () => setSaved({ result, status: 'saved' }),
      (error: unknown) => {
        console.error('[stats] failed to save result', error)
        setSaved({ result, status: 'error' })
      },
    )
  }, [result, statsSink])
  const saveStatus: SaveStatus = saved?.result === result ? saved.status : 'saving'

  // Shift + R (or Ctrl + Shift + R) restarts. Runs in the capture phase and stops
  // the event so the typing handler never sees it as a typed "r".
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return
      if (!event.shiftKey || event.altKey || event.metaKey) return
      if (event.key.toLowerCase() !== 'r') return
      event.preventDefault()   // also blocks the browser's hard reload on Ctrl+Shift+R
      event.stopPropagation()
      ;(document.activeElement as HTMLElement | null)?.blur()
      restart()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [restart])

  return (
    <div className="tt">
      <StatsBar
        timeLeftMs={test.timeLeftMs}
        wpm={test.wpm}
        accuracy={test.accuracy}
        hasTyped={test.keystrokeCount > 0}
      />

      {test.board ? (
        <WordsDisplay board={test.board} showCursor={test.status !== 'finished'} />
      ) : (
        <div className="tt-words tt-placeholder">Loading words…</div>
      )}

      <div className="tt-actions">
        <div className="tt-restart">
          <NavButton
            hotkey={['Sh', 'R']}
            onClick={() => {
              // Drop focus so the next space bar press types instead of
              // clicking the button again.
              ;(document.activeElement as HTMLElement | null)?.blur()
              restart()
            }}
          >
            Restart
          </NavButton>
        </div>
        <span className="tt-hint">
          {test.status === 'idle' && 'Start typing to begin the timer.'}
          {test.wordBankSource === 'fallback' && ' Using the offline word bank.'}
        </span>
      </div>

      {result && <ResultsPanel result={result} saveStatus={saveStatus} />}
    </div>
  )
}