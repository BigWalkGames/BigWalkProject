import { useState } from 'react'
import { TypingTest } from './features/typing/components/TypingTest'
import {
  createSoloWordBankLoader,
  soloHistory,
  soloStatsSink,
  type AdaptiveBankInfo,
} from './features/word-engine'
import { WordEngineDebugPanel } from './features/word-engine/components/WordEngineDebugPanel'

function Game() {
  const [bankInfo, setBankInfo] = useState<AdaptiveBankInfo | null>(null)
  // Created once so `loader.load` keeps the same identity across renders.
  const [loader] = useState(() => createSoloWordBankLoader({ onResult: setBankInfo }))
  // Bumped to remount the test (fresh bank) after resetting saved results.
  const [round, setRound] = useState(0)

  return (
    <main>
      <h1>Solo Time Attack</h1>
      <TypingTest
        key={round}
        durationMs={30_000}
        loadBank={loader.load}
        statsSink={soloStatsSink}
      />
      {import.meta.env.DEV && (
        <WordEngineDebugPanel
          info={bankInfo}
          onResetHistory={() => {
            soloHistory.clear()
            setRound((r) => r + 1)
          }}
        />
      )}
    </main>
  )
}

export default Game
