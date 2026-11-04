import type { CSSProperties } from 'react'
import type { KeyStats } from '../stats/types'
import { heatColor } from './heatColor'
import { KEYBOARD_ROWS } from './keyboardLayout'
import './heatmap.css'

/**
 * Keyboard colored by this match's per-key accuracy. Keys typed this match
 * get a tint from --color-negative (missed) to the green (accurate);
 * everything else is a plain keycap.
 */
export function KeyboardHeatmap({ perKey }: { perKey: Record<string, KeyStats> }) {
  return (
    <div className="kb" role="group" aria-label="Per-key accuracy heatmap">
      {KEYBOARD_ROWS.flat().map((spec) => {
        const stats = spec.char !== undefined ? perKey[spec.char] : undefined
        const color = heatColor(stats)
        const className = [
          'kb-key',
          spec.char === undefined && 'kb-key--blank',
          spec.char === ' ' && 'kb-key--space',
          color && 'kb-key--heat',
        ]
          .filter(Boolean)
          .join(' ')
        const style = {
          gridColumn: spec.span ? `span ${spec.span}` : undefined,
          '--heat': color,
        } as CSSProperties

        return (
          <span
            key={spec.id}
            className={className}
            style={style}
            title={spec.char === undefined ? undefined : describe(spec.label, stats)}
            aria-hidden={spec.char === undefined || undefined}
          >
            <span className="kb-key__label">{spec.label}</span>
          </span>
        )
      })}
    </div>
  )
}

function describe(label: string, stats: KeyStats | undefined): string {
  if (!stats) return `${label}: not typed`
  return `${label}: ${Math.round(stats.accuracy * 100)}% (${stats.correct} of ${stats.attempts})`
}
