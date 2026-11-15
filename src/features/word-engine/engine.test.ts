import { beforeEach, describe, expect, it } from 'vitest'
import {
    BACKSPACE,
    buildWordBank,
    cleanKeystrokes,
    classifyBigram,
    getWordBank,
    updateStats,
    words,
    type Keystroke,
    type PlayerData,
} from '.'
import {
    WEAK_BIGRAM,
    hasWeakBigram,
    isCommonWord,
    itemStats,
    savedBigramStats,
    seedRandom,
} from '../../tests/wordEngineFixtures'

const TARGETED_COUNT = 18 // 60% of 30

function player(overrides: Partial<PlayerData> = {}): PlayerData {
    return { userId: 'member', netWpm: 70, netAccuracy: 0.9, bigramStats: {}, keyStats: {}, ...overrides }
}

const weakCount = (bank: { word: string }[]) => bank.filter((w) => hasWeakBigram(w.word)).length

beforeEach(() => seedRandom(1))

describe('getWordBank with saved data', () => {
    it('fills the targeted share with words containing a slow bigram', () => {
        const saved = player({ bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaLatency: 300 } }) })
        expect(weakCount(getWordBank(words, 30, saved))).toBeGreaterThanOrEqual(TARGETED_COUNT)
    })

    it('fills the targeted share with words containing an error-prone bigram', () => {
        const saved = player({ bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaErrorRate: 0.3 } }) })
        expect(weakCount(getWordBank(words, 30, saved))).toBeGreaterThanOrEqual(TARGETED_COUNT)
    })

    it('leaves recent words out of the targeted share', () => {
        const saved = player({ bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaLatency: 300 } }) })
        const recent = new Set(words.filter((w) => hasWeakBigram(w.word)).map((w) => w.word))
        const targeted = getWordBank(words, 30, saved, recent).filter((w) => !isCommonWord(w.word))
        expect(targeted).toEqual([])
    })

    it("doesn't flag a class of bigrams that is slow for everyone", () => {
        const slowClass = Object.fromEntries(
            Object.keys(savedBigramStats())
                .filter((bigram) => classifyBigram(bigram) === 'same_finger')
                .map((bigram) => [bigram, { ewmaLatency: 300 }]),
        )
        const saved = player({ bigramStats: savedBigramStats(slowClass) })
        expect(getWordBank(words, 30, saved).every((w) => isCommonWord(w.word))).toBe(true)
    })

    it('returns the requested count with no duplicates', () => {
        const saved = player({ bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaLatency: 300 } }) })
        const bank = getWordBank(words, 30, saved).map((w) => w.word)
        expect(bank).toHaveLength(30)
        expect(new Set(bank).size).toBe(30)
    })
})

describe('getWordBank without usable saved data', () => {
    const expectCommonWordsOnly = (bank: { word: string }[]) => {
        expect(bank).toHaveLength(30)
        expect(bank.every((w) => isCommonWord(w.word))).toBe(true)
    }

    it('uses common words when there is no player', () => {
        expectCommonWordsOnly(getWordBank(words, 30, null))
    })

    it('uses common words for a member with no stats', () => {
        expectCommonWordsOnly(getWordBank(words, 30, player()))
    })

    it('uses common words until a bigram has enough samples', () => {
        const bigramStats = { [WEAK_BIGRAM]: itemStats({ ewmaLatency: 300, latencySamples: 9 }) }
        expectCommonWordsOnly(getWordBank(words, 30, player({ bigramStats })))
    })

    it('uses common words below the beginner speed, even with weak bigrams saved', () => {
        const saved = player({
            netWpm: 24,
            bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaLatency: 300 } }),
        })
        expectCommonWordsOnly(getWordBank(words, 30, saved))
    })
})

describe('buildWordBank', () => {
    it('separates targeted words from common words and names the focused bigram', () => {
        const saved = player({ bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaLatency: 300 } }) })

        const { words: bank, targeted, natural, mode, focusedBigrams } = buildWordBank(words, 30, saved)

        expect(mode).toBe('speed')
        expect(targeted).toHaveLength(TARGETED_COUNT)
        expect(natural).toHaveLength(30 - TARGETED_COUNT)
        expect(new Set(bank)).toEqual(new Set([...targeted, ...natural]))
        expect(targeted.every((w) => hasWeakBigram(w.word))).toBe(true)
        expect(focusedBigrams).toHaveLength(1)
        expect(focusedBigrams[0]).toMatchObject({ bigram: WEAK_BIGRAM, cls: 'alternation', latencyMs: 300, classLatencyMs: 100 })
        expect(focusedBigrams[0].words.sort()).toEqual(targeted.map((w) => w.word).sort())
    })

    it('lists focused bigrams weakest first', () => {
        const saved = player({
            bigramStats: savedBigramStats({
                [WEAK_BIGRAM]: { ewmaLatency: 150 },
                th: { ewmaLatency: 400 },
            }),
        })
        expect(buildWordBank(words, 30, saved).focusedBigrams[0].bigram).toBe('th')
    })

    it('focuses on nothing without saved data', () => {
        expect(buildWordBank(words, 30, player())).toMatchObject({ mode: 'cold_start', targeted: [], focusedBigrams: [] })
    })

    it('gives getWordBank the same bank', () => {
        const saved = player({ bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaLatency: 300 } }) })
        const restore = seedRandom(7)
        const built = buildWordBank(words, 30, saved).words
        restore()
        seedRandom(7)
        expect(getWordBank(words, 30, saved)).toEqual(built)
    })
})

describe('cleanKeystrokes', () => {
    // The README's example: "the" with one mistake on "h".
    const log: Keystroke[] = [
        { expected: 't', typed: 't', latencyMs: 420, wordIndex: 0, charIndex: 0 },
        { expected: 'h', typed: 'j', latencyMs: 160, wordIndex: 0, charIndex: 1 },
        { expected: 'h', typed: BACKSPACE, latencyMs: 210, wordIndex: 0, charIndex: 1 },
        { expected: 'h', typed: 'h', latencyMs: 240, wordIndex: 0, charIndex: 1 },
        { expected: 'e', typed: 'e', latencyMs: 150, wordIndex: 0, charIndex: 2 },
        { expected: ' ', typed: ' ', latencyMs: 140, wordIndex: 0, charIndex: 3 },
    ]

    it('keeps the first attempt and drops backspaces, retypes and spaces', () => {
        expect(cleanKeystrokes(log)).toEqual({
            errors: [
                { bigram: 'th', key: 'h', error: true },
                { bigram: 'he', key: 'e', error: false },
            ],
            latencies: [{ bigram: 'he', latencyMs: 150 }],
        })
    })
})

describe('updateStats', () => {
    it('folds samples into new stats without changing the input', () => {
        const before = player({ bigramStats: { th: itemStats({ ewmaLatency: 100, latencySamples: 1, errorSamples: 1 }) } })
        const snapshot = structuredClone(before)

        const after = updateStats(before, {
            errors: [{ bigram: 'th', key: 'h', error: true }],
            latencies: [{ bigram: 'th', latencyMs: 200 }],
        })

        expect(before).toEqual(snapshot)
        expect(after.bigramStats.th).toEqual({ ewmaLatency: 150, latencySamples: 2, ewmaErrorRate: 0.5, errorSamples: 2 })
        expect(after.keyStats.h).toEqual({ ewmaLatency: 0, latencySamples: 0, ewmaErrorRate: 1, errorSamples: 1 })
    })
})
