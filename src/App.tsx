import { TypingTest } from './features/typing/components/TypingTest'

function App() {
  return (
    <main>
      <h1>Solo Time Attack</h1>
      <TypingTest durationMs={60_000} />
    </main>
  )
}

export default App
