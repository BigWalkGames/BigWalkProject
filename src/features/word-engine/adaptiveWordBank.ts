import type { LoadedWordBank } from '../typing/wordbank/types'
import type { PlayerHistory } from './history.ts'
import { profileFromResults, type ProfileOptions } from './profile.ts'
import type { BankRequest, PlayerData, WordBankResult, WordEngine } from './types.ts'

/** What happened on one load, for debugging UIs and logging. */
export interface AdaptiveBankInfo {
  /** The engine's output, or null if the engine failed and plain words were used. */
  result: WordBankResult | null
  /** The profile the bank was built for (null = new player). */
  player: PlayerData | null
  /** How many past results the profile used. */
  historyCount: number
  /** Where the words came from ('supabase' | 'server' | 'fallback'). */
  source: LoadedWordBank['source']
  /** Set when the engine (or history) failed. */
  error?: unknown
}

export interface AdaptiveWordBankOptions {
  engine: WordEngine
  /** Word source: the existing loadWordBank (never rejects, falls back offline). */
  loadWords: () => Promise<LoadedWordBank>
  /** Past results. Omit to always build as for a new player. */
  history?: PlayerHistory
  /** count / difficulty / targetDifficulty; a function is re-read on every load. */
  request?: Omit<BankRequest, 'avoid'> | (() => Omit<BankRequest, 'avoid'>)
  /** How results are combined into a profile. */
  profile?: ProfileOptions
  /** Leave the previous bank's words out of the next one. Default true. */
  avoidRepeats?: boolean
  /** Called after every load with what the engine did. */
  onResult?: (info: AdaptiveBankInfo) => void
}

export interface AdaptiveWordBankLoader {
  /**
   * Same contract as loadWordBank(): resolves with { words, source } and
   * never rejects. Pass it straight to useTypingTest / <TypingTest loadBank>.
   * Stable identity, so it is safe in React dependency arrays.
   */
  load(): Promise<LoadedWordBank>
  /** The words of the most recent bank (empty before the first load). */
  lastBank(): readonly string[]
}

/**
 * Glue between the game and the engine:
 *   loadWords() -> words, history -> profile, engine.build() -> bank.
 * If anything in the engine step fails, the plain loaded words are returned
 * so the game always gets something to type.
 */
export function createAdaptiveWordBankLoader(options: AdaptiveWordBankOptions): AdaptiveWordBankLoader {
  const { engine, loadWords, history, avoidRepeats = true, onResult } = options
  let previous: readonly string[] = []

  async function load(): Promise<LoadedWordBank> {
    const loaded = await loadWords()

    let results: Awaited<ReturnType<PlayerHistory['getRecentResults']>> = []
    let historyError: unknown
    if (history) {
      try {
        results = await history.getRecentResults(options.profile?.maxResults ?? 20)
      } catch (error) {
        historyError = error
        console.warn('[word-engine] could not read history; building for a new player.', error)
      }
    }

    const player = profileFromResults(results, options.profile)
    const base = typeof options.request === 'function' ? options.request() : options.request

    try {
      const result = engine.build(loaded.words, player, {
        ...base,
        avoid: avoidRepeats ? previous : undefined,
      })
      previous = result.words
      onResult?.({ result, player, historyCount: results.length, source: loaded.source, error: historyError })
      return { words: result.words, source: loaded.source }
    } catch (error) {
      console.warn('[word-engine] engine failed; using the plain word list.', error)
      onResult?.({ result: null, player, historyCount: results.length, source: loaded.source, error })
      return loaded
    }
  }

  return { load, lastBank: () => previous }
}
