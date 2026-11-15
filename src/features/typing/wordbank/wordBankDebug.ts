import { DEFAULT_CONFIG, type BuiltWordBank, type PlayerData } from '../../../features/word-engine'

const PROGRESS_BIGRAMS = 5

declare global {
  // Browser console command: run focusedBigrams() during or after a Time Attack match.
  var focusedBigrams: () => void
}

let lastBank: BuiltWordBank | 'fallback' | null = null
let lastPlayer: PlayerData | null = null

// `player` is the stats the bank was built from, or null if they failed to load.
export function rememberWordBank(bank: BuiltWordBank | 'fallback', player: PlayerData | null = null): void {
  lastBank = bank
  lastPlayer = player
}

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`

function sampleProgress(player: PlayerData): string {
  const closest = Object.entries(player.bigramStats)
    .sort(([, a], [, b]) => b.latencySamples - a.latencySamples)
    .slice(0, PROGRESS_BIGRAMS)
    .map(([bigram, s]) => `${bigram} ${s.latencySamples}/${DEFAULT_CONFIG.minSamples}`)
  return closest.length > 0 ? `Closest: ${closest.join(', ')}.` : 'No bigrams recorded yet.'
}

function noTargetingReason(bank: BuiltWordBank, player: PlayerData | null): string {
  if (!player) {
    return 'Your stats failed to load, so this bank uses common words only. See the [wordbank] warning.'
  }
  if (bank.mode === 'beginner') {
    return `Beginner mode: net WPM ${bank.netWpm?.toFixed(1)} is under ${DEFAULT_CONFIG.beginnerWpm}.`
  }
  if (bank.mode === 'cold_start') {
    return `Cold start: no bigram had ${DEFAULT_CONFIG.minSamples} latency samples when this bank was built. ${sampleProgress(player)} Your latest match counts toward the next bank.`
  }
  return 'No bigram is weaker than its class baseline.'
}

function printFocusedBigrams(): void {
  if (lastBank === null) {
    console.log('[word-engine] No word bank loaded yet. Open Time Attack first.')
    return
  }
  if (lastBank === 'fallback') {
    console.log('[word-engine] This bank is the fallback list, so the word engine did not pick it.')
    return
  }

  const { words, targeted, natural, mode, focusedBigrams } = lastBank
  console.group(`[word-engine] Current word bank: ${mode} mode, ${targeted.length} of ${words.length} words targeted`)
  if (focusedBigrams.length === 0) {
    console.log(`Nothing targeted. ${noTargetingReason(lastBank, lastPlayer)}`)
  } else {
    console.log('Focused bigrams, weakest first:')
    console.table(
      focusedBigrams.map((b) => ({
        bigram: b.bigram,
        class: b.cls,
        weakness: Number(b.weakness.toFixed(3)),
        latencyMs: Math.round(b.latencyMs),
        classLatencyMs: Math.round(b.classLatencyMs),
        errorRate: percent(b.errorRate),
        classErrorRate: percent(b.classErrorRate),
        samples: b.latencySamples,
        targetedWords: b.words.join(', '),
      })),
    )
    console.log(`Targeted words: ${targeted.map((w) => w.word).join(', ')}`)
  }
  console.log(`Common words (random, may contain weak bigrams by chance): ${natural.map((w) => w.word).join(', ')}`)
  console.groupEnd()
}

globalThis.focusedBigrams = printFocusedBigrams
