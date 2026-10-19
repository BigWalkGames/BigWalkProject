import type { TestResult } from '../stats/types'
import { displayKey, formatPercent } from './format'
import { Stat } from './StatsBar'

export type SaveStatus = 'saving' | 'saved' | 'error'

const SAVE_LABEL: Record<SaveStatus, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't save result",
}

export function ResultsPanel({ result, saveStatus }: { result: TestResult; saveStatus: SaveStatus }) {
  // Worst keys first; ties broken by how often the key came up.
  const keys = Object.entries(result.perKey).sort(
    ([, a], [, b]) => a.accuracy - b.accuracy || b.attempts - a.attempts,
  )

  return (
    <section className="tt-results" aria-label="Results">
      <div className="tt-stats">
        <Stat label="WPM" value={Math.round(result.wpm).toString()} />
        <Stat label="Accuracy" value={formatPercent(result.accuracy)} />
        <Stat label="Raw WPM" value={Math.round(result.rawWpm).toString()} />
        <Stat label="Keystrokes" value={result.keystrokes.length.toString()} />
      </div>

      <p className={`tt-save is-${saveStatus}`}>{SAVE_LABEL[saveStatus]}</p>

      {keys.length > 0 && (
        <table className="tt-keys">
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Accuracy</th>
              <th scope="col">Correct</th>
              <th scope="col">Attempts</th>
              <th scope="col">Most mistyped as</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(([key, stats]) => (
              <tr key={key}>
                <th scope="row" className="tt-key">{displayKey(key)}</th>
                <td>{formatPercent(stats.accuracy)}</td>
                <td>{stats.correct}</td>
                <td>{stats.attempts}</td>
                <td className="tt-key">{topMistake(stats.mistypedAs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function topMistake(mistypedAs: Record<string, number>): string {
  const entries = Object.entries(mistypedAs)
  if (entries.length === 0) return '—'
  const [key, count] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))
  return `${displayKey(key)} (${count}×)`
}
