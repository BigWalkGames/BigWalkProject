/**
 * One block per letter, grouped by word. `typed` is the player's keystroke count,
 * so for the opponent (server totals, sent on an interval) the bar is approximate.
 */
export function PlayerProgress({ words, typed }: { words: string[]; typed: number }) {
  let offset = 0
  return (
    <div className="player-progress">
      {words.map((word, w) => {
        const start = offset
        offset += word.length + 1 // +1 for the space after the word
        return (
          <span key={w} className="pp-word">
            {[...word].map((_, i) => (
              <span key={i} className={start + i < typed ? 'pp-block is-typed' : 'pp-block'} />
            ))}
          </span>
        )
      })}
    </div>
  )
}
