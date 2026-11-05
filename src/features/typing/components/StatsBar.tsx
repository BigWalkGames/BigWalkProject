import { useEffect, useState, type ReactNode } from 'react'
import { computeNetWpm } from '../stats/computeStats'
import { formatPercent } from './format'

/** How often the countdown and live WPM refresh while the test runs. */
const TICK_MS = 100

/**
 * The live stats row for a typing test. It owns the ticking clock, so each
 * tick re-renders only this row, not the word box. WPM and accuracy come from
 * running totals (no board or keystroke rescans) with the same formulas as
 * the final result, so the live numbers match it.
 */
export function LiveStats({
  startedAt,
  endedAt,
  durationMs,
  keystrokeCount,
  correctCount,
  failCount,
}: {
  startedAt: number | null
  endedAt: number | null
  durationMs: number
  keystrokeCount: number
  correctCount: number
  failCount: number
}) {
  const [now, setNow] = useState(0)
  const running = startedAt !== null && endedAt === null

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [running])

  let elapsedMs = 0
  if (startedAt !== null) {
    const end = endedAt ?? Math.max(now, startedAt)
    elapsedMs = Math.min(Math.max(0, end - startedAt), durationMs)
  }

  return (
    <StatsBar
      timeLeftMs={durationMs - elapsedMs}
      wpm={computeNetWpm(keystrokeCount, failCount, elapsedMs)}
      accuracy={keystrokeCount === 0 ? 0 : correctCount / keystrokeCount}
      hasTyped={keystrokeCount > 0}
    />
  )
}

export function StatsBar({
  timeLeftMs,
  wpm,
  accuracy,
  hasTyped,
}: {
  timeLeftMs: number
  wpm: number
  accuracy: number
  hasTyped: boolean
}) {
  return (
    <div className="tt-stats">
      <Stat label="Time" value={`${Math.ceil(timeLeftMs / 1000)}s`} />
      <Stat label="WPM" value={Math.round(wpm).toString()} />
      <Stat label="Accuracy" value={hasTyped ? formatPercent(accuracy) : '—'} />
    </div>
  )
}

export function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={className ? `tt-stat ${className}` : 'tt-stat'}>
      <span className="tt-stat-value">{value}</span>
      <span className="tt-stat-label">{label}</span>
    </div>
  )
}
