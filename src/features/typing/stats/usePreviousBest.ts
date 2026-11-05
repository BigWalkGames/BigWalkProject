import { useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/auth/useAuth'
import { getSupabase } from '../../../lib/supabase'
import type { TestResult } from './types'

/** A row from the get_all_matches RPC (same one useMatchHistory reads). */
type MatchRow = { match_time: string; wpm: number }

/**
 * The player's best Time Attack WPM before `result`, from their saved history.
 * - undefined: still loading, or the lookup failed (no celebration either way)
 * - null: no earlier match, so there's nothing to beat yet
 * The row for `result` itself is skipped, since the results screen may save
 * it before this lookup runs.
 */
export function usePreviousBest(result: TestResult | undefined): number | null | undefined {
  const { user } = useAuth()
  const [best, setBest] = useState<{ for: TestResult; value: number | null } | null>(null)

  useEffect(() => {
    if (!result || !user) return
    let cancelled = false
    const finishedAt = Date.parse(result.completedAt)

    getSupabase()
      .rpc('get_all_matches', { id: user.id })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[high score] get_all_matches failed', error)
          return
        }
        const earlier = ((data ?? []) as MatchRow[]).filter(
          // Timestamps come back as "+00:00" instead of "Z", so compare times.
          (row) => Math.abs(Date.parse(row.match_time) - finishedAt) >= 1000,
        )
        const value = earlier.length ? Math.max(...earlier.map((row) => Number(row.wpm))) : null
        setBest({ for: result, value })
      })

    return () => {
      cancelled = true
    }
  }, [result, user])

  return best && best.for === result ? best.value : undefined
}

/** A new high score: beats a real earlier score once both are rounded. Ties don't count. */
export function isHighScore(wpm: number, previousBest: number | null | undefined): boolean {
  if (previousBest === null || previousBest === undefined) return false
  return Math.round(wpm) > Math.round(previousBest)
}
