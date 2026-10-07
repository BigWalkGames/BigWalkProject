import { formatPercent } from './format'

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

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tt-stat">
      <span className="tt-stat-value">{value}</span>
      <span className="tt-stat-label">{label}</span>
    </div>
  )
}
