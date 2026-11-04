import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWordBank, words, type PlayerData } from '../../word-engine'
import { WEAK_BIGRAM, itemStats, savedBigramStats, seedRandom } from '../../../tests/wordEngineFixtures'
import { rememberWordBank } from './wordBankDebug'

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { userId: 'member', netWpm: 70, netAccuracy: 0.9, bigramStats: {}, keyStats: {}, ...overrides }
}

function printed(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map((call) => String(call[0])).join('\n')
}

let log: ReturnType<typeof vi.spyOn>
let group: ReturnType<typeof vi.spyOn>
let table: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  group = vi.spyOn(console, 'group').mockImplementation(() => {})
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  table = vi.spyOn(console, 'table').mockImplementation(() => {})
  return seedRandom(1)
})

describe('focusedBigrams console command', () => {
  it('lists the bigrams and words the engine targeted', () => {
    const saved = player({ bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaErrorRate: 0.3 } }) })
    const bank = buildWordBank(words, 30, saved)
    rememberWordBank(bank, saved)

    globalThis.focusedBigrams()

    expect(printed(group)).toContain('speed mode, 18 of 30 words targeted')
    const rows = table.mock.calls[0][0] as { bigram: string; errorRate: string; targetedWords: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ bigram: WEAK_BIGRAM, errorRate: '30.0%' })
    expect(rows[0].targetedWords.split(', ')).toHaveLength(18)
    expect(printed(log)).toContain(`Targeted words: ${bank.targeted.map((w) => w.word).join(', ')}`)
  })

  it('explains cold start for a new player', () => {
    const fresh = player()
    rememberWordBank(buildWordBank(words, 30, fresh), fresh)

    globalThis.focusedBigrams()

    expect(printed(log)).toContain('Cold start')
    expect(printed(log)).toContain('No bigrams recorded yet.')
    expect(printed(log)).toContain('counts toward the next bank')
    expect(table).not.toHaveBeenCalled()
  })

  it('shows the bigrams closest to leaving cold start, most samples first', () => {
    const counts = { er: 9, in: 8, ti: 7, on: 6, at: 5, an: 4 }
    const bigramStats = Object.fromEntries(
      Object.entries(counts).map(([bigram, latencySamples]) => [bigram, itemStats({ latencySamples })]),
    )
    const partway = player({ bigramStats })
    rememberWordBank(buildWordBank(words, 30, partway), partway)

    globalThis.focusedBigrams()

    expect(printed(log)).toContain('Closest: er 9/10, in 8/10, ti 7/10, on 6/10, at 5/10.')
  })

  it('says when stats failed to load instead of reporting cold start', () => {
    rememberWordBank(buildWordBank(words, 30, null), null)

    globalThis.focusedBigrams()

    expect(printed(log)).toContain('failed to load')
    expect(printed(log)).not.toContain('Cold start')
  })

  it('explains beginner mode', () => {
    const saved = player({ netWpm: 24, bigramStats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaLatency: 300 } }) })
    rememberWordBank(buildWordBank(words, 30, saved), saved)

    globalThis.focusedBigrams()

    expect(printed(log)).toContain('net WPM 24.0 is under 25')
    expect(table).not.toHaveBeenCalled()
  })

  it('says when the engine did not pick the bank', () => {
    rememberWordBank('fallback')

    globalThis.focusedBigrams()

    expect(printed(log)).toContain('fallback list')
  })
})
