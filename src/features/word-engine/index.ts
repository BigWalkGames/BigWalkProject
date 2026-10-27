// Public API of the word engine. Import from 'features/word-engine', not from its internal files.
export {
    BACKSPACE,
    DEFAULT_CONFIG,
    classifyBigram,
    cleanKeystrokes,
    computeBaselines,
    getFeedback,
    getWordBank,
    pickMode,
    updateStats,
} from './engine'
export type {
    Baselines,
    BigramClass,
    CleanedSamples,
    ItemStats,
    Keystroke,
    Mode,
    PlayerData,
    PlayerFeedback,
    WordEngineConfig,
} from './engine'
export { words } from './words'
export type { Word } from './words'
