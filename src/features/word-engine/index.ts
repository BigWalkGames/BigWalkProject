// Public API of the word engine. Import from 'features/word-engine', not from its internal files.
export {
    BACKSPACE,
    DEFAULT_CONFIG,
    buildWordBank,
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
    BuiltWordBank,
    CleanedSamples,
    FocusedBigram,
    ItemStats,
    Keystroke,
    Mode,
    PlayerData,
    PlayerFeedback,
    WordEngineConfig,
} from './engine'
export { words } from './words'
export type { Word } from './words'
