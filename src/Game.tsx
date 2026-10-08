import { TypingTest } from './features/typing/components/TypingTest'

function Game() {
  return (
    <main>
      <h1>Solo Time Attack</h1>
      <TypingTest durationMs={30_000} />
    </main>
  )
}

export default Game
