/**
 * One block per letter, grouped by word. `wordResults` has one letter per completed
 * word ('g' no mistakes, 'r' had a mistake). Words still in progress stay neutral.
 */
export function PlayerProgress({ words, wordResults }: { words: string[]; wordResults: string }) {
  return (
    <div className="player-progress">
      {words.map((word, w) => {
        const state = wordResults[w] === 'g' ? ' is-correct' : wordResults[w] === 'r' ? ' is-incorrect' : ''
        return (
          <span key={w} className={`pp-word${state}`}>
            {[...word].map((_, i) => (
              <span key={i} className="pp-block" />
            ))}
          </span>
        )
      })}
    </div>
  )
}
