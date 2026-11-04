import type { KeyStats } from '../stats/types'

/**
 * The color for one key on the heatmap: a blend from --color-negative at 0%
 * accuracy to the typing feature's green (--tt-positive, falling back to the
 * design token --color-positive) at 100%. Mixing in oklch passes through
 * yellow/orange instead of brown, so mid accuracies are easier to tell apart.
 * Keys with no attempts this match get no color (undefined), so they show as
 * a plain, neutral keycap.
 */
export function heatColor(stats: KeyStats | undefined): string | undefined {
  if (!stats || stats.attempts === 0) return undefined
  const positive = Math.round(stats.accuracy * 100)
  return `color-mix(in oklch, var(--tt-positive, var(--color-positive)) ${positive}%, var(--color-negative))`
}
