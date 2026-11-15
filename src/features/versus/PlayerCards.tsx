import { useEffect, useState } from 'react'
import { computeNetWpm } from '../typing/stats/computeStats'

type Counts = { typed: number; correct: number; errors: number }
type Official = { wpm: number; accuracy: number } // accuracy as a percent (0-100)

const TICK_MS = 250

/**
 * The two player cards beside the words: YOU and OPPONENT with WPM and accuracy.
 * While racing the numbers are live (the opponent's are worked out from the progress the
 * server relays, so they are close, not exact). When the match ends the server's
 * official numbers replace them.
 */
export function PlayerCards({
  racing,
  startedAt,
  durationMs,
  me,
  opponent,
  myOfficial,
  theirOfficial,
  winner,
}: {
  racing: boolean
  startedAt: number | null
  durationMs: number
  me: Counts
  opponent: { typed: number; correct: number }
  myOfficial?: Official
  theirOfficial?: Official
  winner: 'me' | 'them' | null
}) {
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!racing) return
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [racing])

  const elapsedMs = racing && startedAt !== null ? Math.min(Math.max(0, now - startedAt), durationMs) : 0

  const live = (typed: number, correct: number, errors: number): Official | undefined =>
    typed === 0 || elapsedMs < 1000
      ? undefined
      : { wpm: Math.round(computeNetWpm(typed, errors, elapsedMs)), accuracy: Math.round((correct / typed) * 100) }

  const mine = myOfficial ?? live(me.typed, me.correct, me.errors)
  const theirs = theirOfficial ?? live(opponent.typed, opponent.correct, opponent.typed - opponent.correct)

  return (
    <div className="player-cards">
      <Card name="You" stats={mine} isWinner={winner === 'me'} />
      <Card name="Opponent" stats={theirs} isWinner={winner === 'them'} />
    </div>
  )
}

function Card({ name, stats, isWinner }: { name: string; stats?: Official; isWinner: boolean }) {
  return (
    <div className={`player-card${isWinner ? ' is-winner' : ''}`} aria-label={`${name} stats`}>
      <span className="player-card__name">{name}</span>
      <span className="player-card__stats">
        <span>{stats ? stats.wpm : '--'}<small> WPM</small></span>
        <span>{stats ? `${stats.accuracy}%` : '--'}<small> ACC</small></span>
      </span>
    </div>
  )
}
