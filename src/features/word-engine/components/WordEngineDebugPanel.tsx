import type { AdaptiveBankInfo } from '../adaptiveWordBank.ts'
import './wordEngineDebug.css'

/**
 * Development aid: shows why the engine picked the current bank. Render it
 * only in dev builds (import.meta.env.DEV).
 */
export function WordEngineDebugPanel({
  info,
  onResetHistory,
}: {
  info: AdaptiveBankInfo | null
  onResetHistory: () => void
}) {
  const result = info?.result

  return (
    <details className="we-debug" open>
      <summary>WordEngine (dev)</summary>
      {!info ? (
        <p>Loading…</p>
      ) : !result ? (
        <p className="we-debug-error">Engine failed; using plain words. {String(info.error ?? '')}</p>
      ) : (
        <dl>
          <dt>Player</dt>
          <dd>
            {info.player
              ? `${info.player.wpm.toFixed(1)} WPM, ${(info.player.accuracy * 100).toFixed(1)}% ` +
                `(from ${info.historyCount} saved result${info.historyCount === 1 ? '' : 's'})`
              : 'new player (no saved results yet)'}
          </dd>
          <dt>Skill</dt>
          <dd>
            {result.skill.toFixed(1)} / 100 → target difficulty {result.targetDifficulty.toFixed(1)}
            {' '}(bank average {result.meanDifficulty.toFixed(1)})
          </dd>
          <dt>Weak keys</dt>
          <dd>
            {result.weakKeys.length === 0
              ? 'none'
              : result.weakKeys
                  .map((k) => `${k} ${(result.keyAccuracy[k] * 100).toFixed(0)}%`)
                  .join(', ')}
          </dd>
          <dt>Bank</dt>
          <dd>
            {result.words.length} words, {result.weakWordCount} picked for weak keys
            {' '}(target share {(result.weakRatio * 100).toFixed(0)}%), source: {info.source}
            <div className="we-debug-words">
              {result.words.map((word) => (
                <span key={word} className={hasWeakKey(word, result.weakKeys) ? 'is-weak' : undefined}>
                  {word}
                </span>
              ))}
            </div>
          </dd>
        </dl>
      )}
      <button type="button" className="we-debug-reset" onClick={(e) => {
        e.currentTarget.blur()
        onResetHistory()
      }}>
        Reset saved results
      </button>
    </details>
  )
}

function hasWeakKey(word: string, weakKeys: readonly string[]): boolean {
  return weakKeys.some((k) => word.includes(k))
}
