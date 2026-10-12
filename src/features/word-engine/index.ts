/**
 * WordEngine public API. Import from 'features/word-engine' only; the other
 * files are internal. Full guide: documentation/word-engine.md.
 */

// Engine
export { createWordEngine, type CreateWordEngineOptions } from './engine.ts'
export { DEFAULT_ENGINE_CONFIG, DEFAULT_GLOBAL_KEYS } from './config.ts'
export {
  WordEngineError,
  type BankRequest,
  type DifficultyClass,
  type EngineConfig,
  type GlobalKeyAccuracy,
  type KeyCounts,
  type PlayerData,
  type WordBankResult,
  type WordEngine,
} from './types.ts'
export { LETTERS, type Letter } from './letters.ts'

// Player data
export { profileFromResults, type ProfileInput, type ProfileOptions } from './profile.ts'
export {
  combineStatsSinks,
  createLocalPlayerHistory,
  type LocalHistoryOptions,
  type LocalPlayerHistory,
  type PlayerHistory,
  type StorageLike,
} from './history.ts'

// Game integration
export {
  createAdaptiveWordBankLoader,
  type AdaptiveBankInfo,
  type AdaptiveWordBankLoader,
  type AdaptiveWordBankOptions,
} from './adaptiveWordBank.ts'
export { createSoloWordBankLoader, soloHistory, soloStatsSink, wordEngine } from './session.ts'
