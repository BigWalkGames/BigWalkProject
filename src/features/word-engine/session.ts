/**
 * Ready-made wiring for Solo Time Attack (MVP): the shared engine, a
 * browser-storage history for the current session, and a stats sink that
 * keeps the existing console logging while also recording each result for
 * the engine.
 *
 * Swap points for later sprints:
 * - history:   replace soloHistory with a Supabase-backed PlayerHistory.
 * - words:     loadWordBank() already switches to Supabase when the table exists.
 * - globals:   pass real app-wide key accuracy to createWordEngine({ globalKeys }).
 */

import { consoleStatsSink } from '../typing/stats/consoleStatsSink'
import type { StatsSink } from '../typing/stats/types'
import { loadWordBank } from '../typing/wordbank/loadWordBank'
import {
  createAdaptiveWordBankLoader,
  type AdaptiveBankInfo,
  type AdaptiveWordBankLoader,
} from './adaptiveWordBank.ts'
import { createWordEngine } from './engine.ts'
import { combineStatsSinks, createLocalPlayerHistory } from './history.ts'
import type { BankRequest } from './types.ts'

/** The app's engine with default tuning and placeholder global data. */
export const wordEngine = createWordEngine()

/** This browser's results, newest last. Survives reloads, like a Guest session. */
export const soloHistory = createLocalPlayerHistory(() =>
  typeof localStorage === 'undefined' ? undefined : localStorage,
)

/** Use as <TypingTest statsSink>: logs to the console and feeds the engine. */
export const soloStatsSink: StatsSink = combineStatsSinks(consoleStatsSink, soloHistory)

/**
 * A word bank loader for Solo Time Attack. Create it once per screen (e.g.
 * in useState) and pass `loader.load` to <TypingTest loadBank>.
 */
export function createSoloWordBankLoader(
  options: {
    request?: Omit<BankRequest, 'avoid'> | (() => Omit<BankRequest, 'avoid'>)
    onResult?: (info: AdaptiveBankInfo) => void
  } = {},
): AdaptiveWordBankLoader {
  return createAdaptiveWordBankLoader({
    engine: wordEngine,
    loadWords: () => loadWordBank(),
    history: soloHistory,
    request: options.request,
    onResult: options.onResult,
  })
}
