// Synthetic typist for the test page: turns a word bank into a keystroke log without a real player.
import { BACKSPACE, classifyBigram, type Keystroke } from './engine'
import type { Word } from './words'

export interface SimulatedTypist {
    baseLatencyMs: number
    jitterMs: number            // uniform random extra latency per keystroke
    sameFingerPenaltyMs: number // slower for everyone; the engine should NOT flag these
    wordStartPenaltyMs: number  // reading time before a word's first char
    baseErrorRate: number
    slowBigrams: Record<string, number>    // bigram → extra ms
    errorBigrams: Record<string, number>   // bigram → error rate (replaces base)
}

export const DEFAULT_TYPIST: SimulatedTypist = {
    baseLatencyMs: 150,
    jitterMs: 40,
    sameFingerPenaltyMs: 60,
    wordStartPenaltyMs: 300,
    baseErrorRate: 0.02,
    slowBigrams: { ce: 200, ou: 150 },
    errorBigrams: { br: 0.3 },
}

export function simulateMatch(bank: Word[], typist: SimulatedTypist): Keystroke[] {
    const log: Keystroke[] = []
    bank.forEach((w, wordIndex) => {
        for (let charIndex = 0; charIndex < w.word.length; charIndex++) {
            const expected = w.word[charIndex]
            const bigram = charIndex > 0 ? w.word[charIndex - 1] + expected : ''

            let latencyMs = typist.baseLatencyMs + Math.random() * typist.jitterMs
            if (charIndex === 0) latencyMs += typist.wordStartPenaltyMs
            if (bigram && classifyBigram(bigram) === 'same_finger') latencyMs += typist.sameFingerPenaltyMs
            latencyMs += typist.slowBigrams[bigram] ?? 0

            const errorRate = typist.errorBigrams[bigram] ?? typist.baseErrorRate
            if (Math.random() < errorRate) {
                const wrong = expected === 'x' ? 'z' : 'x'
                log.push({ expected, typed: wrong, latencyMs, wordIndex, charIndex })
                log.push({ expected, typed: BACKSPACE, latencyMs: 200, wordIndex, charIndex })
                log.push({ expected, typed: expected, latencyMs: 250, wordIndex, charIndex })
            } else {
                log.push({ expected, typed: expected, latencyMs, wordIndex, charIndex })
            }
        }
        const charIndex = w.word.length
        log.push({ expected: ' ', typed: ' ', latencyMs: typist.baseLatencyMs, wordIndex, charIndex })
    })
    return log
}
