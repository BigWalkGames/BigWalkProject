import type { Word } from './words'

// ==================================================
// Config
// ==================================================

export interface WordEngineConfig {
    bankSize: number
    targetedRatio: number   // share of targeted words in the bank
    beginnerWpm: number     // below this → suggest beginner mode
    ewmaWindow: number      // samples of memory; newest sample weight = 1 / ewmaWindow
    minSamples: number      // bigram counts toward class baselines
    minClassBigrams: number // fewer qualifying bigrams → class uses the overall baseline
    kErr: number            // error gap weight vs latency gap
    kConf: number           // confidence ramp
    latencyCapMs: number
    latencyCapMult: number  // × player median latency
    minWordLength: number   // targeted words only
    frequencyPool: number   // top-ranked words for natural sampling
}

export const DEFAULT_CONFIG: WordEngineConfig = {
    bankSize: 30,
    targetedRatio: 0.6,
    beginnerWpm: 25,
    ewmaWindow: 50,
    minSamples: 10,
    minClassBigrams: 5,
    kErr: 5,
    kConf: 10,
    latencyCapMs: 1500,
    latencyCapMult: 3,
    minWordLength: 3,
    frequencyPool: 3000,
}

// ==================================================
// Types
// ==================================================

export interface ItemStats {
    ewmaLatency: number
    latencySamples: number
    ewmaErrorRate: number
    errorSamples: number
}

export interface PlayerData {
    userId: string,
    netWpm: number,
    netAccuracy: number,
    bigramStats: Record<string, ItemStats>,
    keyStats: Record<string, ItemStats>,    // error stats only; used for feedback
}

export const BACKSPACE = 'Backspace'

export interface Keystroke {
    expected: string        // char from the word text
    typed: string           // char actually pressed, or BACKSPACE
    latencyMs: number       // time since previous keystroke
    wordIndex: number
    charIndex: number
}

export type BigramClass = 'alternation' | 'roll' | 'row_jump' | 'same_finger' | 'repeat'

const BIGRAM_CLASSES: BigramClass[] = ['alternation', 'roll', 'row_jump', 'same_finger', 'repeat']

export type Baselines = Record<BigramClass, { latency: number, errorRate: number }>

export type Mode = 'beginner' | 'cold_start' | 'speed'

// ==================================================
// Keyboard layout (QWERTY, same map as scripts/build-words.mjs)
// ==================================================

type Hand = 'L' | 'R'

// [hand, finger (0 pinky … 3 index), row (0 top, 1 home, 2 bottom)]
const LAYOUT: Record<string, [Hand, number, number]> = {
    q: ['L', 0, 0], w: ['L', 1, 0], e: ['L', 2, 0], r: ['L', 3, 0], t: ['L', 3, 0],
    a: ['L', 0, 1], s: ['L', 1, 1], d: ['L', 2, 1], f: ['L', 3, 1], g: ['L', 3, 1],
    z: ['L', 0, 2], x: ['L', 1, 2], c: ['L', 2, 2], v: ['L', 3, 2], b: ['L', 3, 2],
    y: ['R', 3, 0], u: ['R', 3, 0], i: ['R', 2, 0], o: ['R', 1, 0], p: ['R', 0, 0],
    h: ['R', 3, 1], j: ['R', 3, 1], k: ['R', 2, 1], l: ['R', 1, 1],
    n: ['R', 3, 2], m: ['R', 3, 2],
}

export function classifyBigram(bigram: string): BigramClass | null {
    const a = LAYOUT[bigram[0]]
    const b = LAYOUT[bigram[1]]
    if (!a || !b) return null
    if (bigram[0] === bigram[1]) return 'repeat'
    if (a[0] !== b[0]) return 'alternation'
    if (a[1] === b[1]) return 'same_finger'
    return Math.abs(a[2] - b[2]) === 2 ? 'row_jump' : 'roll'
}

// ==================================================
// Helpers
// ==================================================

function median(values: number[]): number | null {
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function shuffle<T>(items: T[]): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

// Weighted sampling without replacement (Efraimidis–Spirakis): key = u^(1/w), take the top `count`.
function weightedSample<T>(items: T[], weight: (item: T) => number, count: number): T[] {
    return items
        .map((item) => ({ item, key: Math.random() ** (1 / weight(item)) }))
        .sort((a, b) => b.key - a.key)
        .slice(0, count)
        .map((entry) => entry.item)
}

function emptyStats(): ItemStats {
    return { ewmaLatency: 0, latencySamples: 0, ewmaErrorRate: 0, errorSamples: 0 }
}

// Plain running average until `window` samples, then an EWMA with weight 1 / window.
// Avoids both a 0-biased start and one early sample dominating.
function ewma(current: number, samples: number, value: number, window: number): number {
    const alpha = 1 / Math.min(samples + 1, window)
    return alpha * value + (1 - alpha) * current
}

// ==================================================
// 0. Clean keystrokes
// ==================================================

export interface CleanedSamples {
    errors: { bigram: string, key: string, error: boolean }[]
    latencies: { bigram: string, latencyMs: number }[]
}

export function cleanKeystrokes(log: Keystroke[], config = DEFAULT_CONFIG): CleanedSamples {
    const isCorrect = (k: Keystroke) => k.typed !== BACKSPACE && k.typed === k.expected

    // Player median latency for this match, from correct mid-word keystrokes.
    const playerMedian = median(
        log.filter((k) => isCorrect(k) && k.charIndex > 0).map((k) => k.latencyMs),
    )
    const latencyCap = Math.min(config.latencyCapMs, config.latencyCapMult * (playerMedian ?? Infinity))

    const result: CleanedSamples = { errors: [], latencies: [] }
    const attempted = new Set<string>()

    for (let i = 1; i < log.length; i++) {
        const p = log[i - 1]
        const k = log[i]
        if (k.typed === BACKSPACE) continue

        const position = `${k.wordIndex}:${k.charIndex}`
        const isRetype = attempted.has(position)
        attempted.add(position)

        if (isRetype || k.charIndex === 0) continue
        if (p.expected === ' ' || k.expected === ' ') continue

        const bigram = p.expected + k.expected
        const pWasError = p.typed !== BACKSPACE && !isCorrect(p)

        if (!pWasError) {
            result.errors.push({ bigram, key: k.expected, error: !isCorrect(k) })
        }
        if (isCorrect(p) && isCorrect(k) && k.latencyMs <= latencyCap) {
            result.latencies.push({ bigram, latencyMs: k.latencyMs })
        }
    }
    return result
}

// ==================================================
// 1. Update item stats
// ==================================================

export function updateStats(player: PlayerData, samples: CleanedSamples, config = DEFAULT_CONFIG): PlayerData {
    const bigramStats = { ...player.bigramStats }
    const keyStats = { ...player.keyStats }
    const window = config.ewmaWindow

    for (const { bigram, key, error } of samples.errors) {
        const value = error ? 1 : 0
        for (const [stats, id] of [[bigramStats, bigram], [keyStats, key]] as const) {
            const s = { ...(stats[id] ?? emptyStats()) }
            s.ewmaErrorRate = ewma(s.ewmaErrorRate, s.errorSamples, value, window)
            s.errorSamples++
            stats[id] = s
        }
    }
    for (const { bigram, latencyMs } of samples.latencies) {
        const s = { ...(bigramStats[bigram] ?? emptyStats()) }
        s.ewmaLatency = ewma(s.ewmaLatency, s.latencySamples, latencyMs, window)
        s.latencySamples++
        bigramStats[bigram] = s
    }
    return { ...player, bigramStats, keyStats }
}

// ==================================================
// 2. Class baselines
// ==================================================

// Returns null when no bigram has enough samples yet (cold start).
export function computeBaselines(player: PlayerData, config = DEFAULT_CONFIG): Baselines | null {
    const qualifying = Object.entries(player.bigramStats)
        .filter(([, s]) => s.latencySamples >= config.minSamples)
        .map(([bigram, s]) => ({ cls: classifyBigram(bigram), s }))
        .filter((q) => q.cls !== null)

    const overallLatency = median(qualifying.map((q) => q.s.ewmaLatency))
    const overallError = median(qualifying.map((q) => q.s.ewmaErrorRate))
    if (overallLatency === null || overallError === null) return null

    const baselines = {} as Baselines
    for (const cls of BIGRAM_CLASSES) {
        const inClass = qualifying.filter((q) => q.cls === cls)
        const enough = inClass.length >= config.minClassBigrams
        baselines[cls] = {
            latency: enough ? median(inClass.map((q) => q.s.ewmaLatency))! : overallLatency,
            errorRate: enough ? median(inClass.map((q) => q.s.ewmaErrorRate))! : overallError,
        }
    }
    return baselines
}

// ==================================================
// 3. Weakness
// ==================================================

export function bigramWeakness(
    bigram: string,
    player: PlayerData,
    baselines: Baselines,
    config = DEFAULT_CONFIG,
): number {
    const s = player.bigramStats[bigram]
    const cls = classifyBigram(bigram)
    if (!s || !cls) return 0

    const base = baselines[cls]
    const latencyGap = s.latencySamples > 0 ? Math.max(0, s.ewmaLatency / base.latency - 1) : 0
    const errorGap = Math.max(0, s.ewmaErrorRate - base.errorRate)
    const latencyConfidence = s.latencySamples / (s.latencySamples + config.kConf)
    const errorConfidence = s.errorSamples / (s.errorSamples + config.kConf)

    return latencyGap * latencyConfidence + config.kErr * errorGap * errorConfidence
}

// ==================================================
// 4. Score words
// ==================================================

export function scoreWord(word: Word, weakness: (bigram: string) => number): number {
    if (word.bigrams.length === 0) return 0
    const total = word.bigrams.reduce((sum, b) => sum + weakness(b), 0)
    return total / word.bigrams.length
}

// ==================================================
// 5. Pick mode
// ==================================================

export function pickMode(player: PlayerData | null, baselines: Baselines | null, config = DEFAULT_CONFIG): Mode {
    if (player && player.netWpm < config.beginnerWpm) return 'beginner'
    if (!baselines) return 'cold_start'
    return 'speed'
}

// ==================================================
// Output: word bank
// ==================================================

// `words` must be sorted by rank. `recentWords` = words shown in the last few matches.
// Beginner mode is not defined yet, so it falls back to frequency sampling like cold start.
export function getWordBank(
    words: Word[],
    count: number,
    player: PlayerData | null = null,
    recentWords: ReadonlySet<string> = new Set(),
    config = DEFAULT_CONFIG,
): Word[] {
    const baselines = player ? computeBaselines(player, config) : null
    const mode = pickMode(player, baselines, config)

    let targeted: Word[] = []
    if (mode === 'speed' && player && baselines) {
        const weakness = (b: string) => bigramWeakness(b, player, baselines, config)
        const candidates = words
            .filter((w) => w.length >= config.minWordLength && !recentWords.has(w.word))
            .map((w) => ({ w, score: scoreWord(w, weakness) }))
            .filter((c) => c.score > 0)
        const targetedCount = Math.round(count * config.targetedRatio)
        targeted = weightedSample(candidates, (c) => c.score, targetedCount).map((c) => c.w)
    }

    // Fill the rest uniformly from the most frequent words.
    const chosen = new Set(targeted.map((w) => w.word))
    const pool = words.slice(0, config.frequencyPool).filter((w) => !chosen.has(w.word))
    const natural = shuffle(pool).slice(0, count - targeted.length)

    return shuffle([...targeted, ...natural])
}

// ==================================================
// Output: player feedback
// ==================================================

export interface PlayerFeedback {
    weakestBigrams: { bigram: string, weakness: number }[]
    classSummary: { cls: BigramClass, latencyMs: number, vsAlternationMs: number }[]
    handSummary: { left: number | null, right: number | null }   // accuracy 0–1
}

export function getFeedback(player: PlayerData, config = DEFAULT_CONFIG): PlayerFeedback {
    const baselines = computeBaselines(player, config)

    const weakestBigrams = baselines
        ? Object.keys(player.bigramStats)
            .map((bigram) => ({ bigram, weakness: bigramWeakness(bigram, player, baselines, config) }))
            .filter((b) => b.weakness > 0)
            .sort((a, b) => b.weakness - a.weakness)
            .slice(0, 5)
        : []

    const classSummary = baselines
        ? BIGRAM_CLASSES.map((cls) => ({
            cls,
            latencyMs: baselines[cls].latency,
            vsAlternationMs: baselines[cls].latency - baselines.alternation.latency,
        }))
        : []

    // Sample-weighted accuracy per hand.
    const hands = { L: { errors: 0, samples: 0 }, R: { errors: 0, samples: 0 } }
    for (const [key, s] of Object.entries(player.keyStats)) {
        const pos = LAYOUT[key]
        if (!pos) continue
        hands[pos[0]].errors += s.ewmaErrorRate * s.errorSamples
        hands[pos[0]].samples += s.errorSamples
    }
    const accuracy = (h: { errors: number, samples: number }) =>
        h.samples > 0 ? 1 - h.errors / h.samples : null

    return {
        weakestBigrams,
        classSummary,
        handSummary: { left: accuracy(hands.L), right: accuracy(hands.R) },
    }
}
