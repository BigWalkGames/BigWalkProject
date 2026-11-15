import { beforeEach, describe, expect, it, vi } from 'vitest'
import { words } from '../../word-engine'
import { DEFAULT_TYPIST, simulateMatch } from '../../word-engine/simulate'
import {
  FakeSupabase,
  WEAK_BIGRAM,
  fakeLocalStorage,
  findWord,
  hasWeakBigram,
  isCommonWord,
  playerRow,
  savedBigramStats,
  seedRandom,
} from '../../../tests/wordEngineFixtures'
import type { WordBankSource } from './types'

const supabase = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('../../../lib/supabase', () => ({ getSupabase: () => supabase.current }))

const MEMBER = 'member-1'
const TARGETED_COUNT = 18 // 60% of 30

const source: WordBankSource = { name: 'supabase', fetchWords: async () => words }

const weakBigramRow = () =>
  playerRow(MEMBER, { bigram_stats: savedBigramStats({ [WEAK_BIGRAM]: { ewmaErrorRate: 0.3 } }) })

// loadWordBank and playerStore keep session state, so each test gets fresh modules.
async function freshStore() {
  vi.resetModules()
  const { loadWordBank } = await import('./loadWordBank')
  const { recordMatch } = await import('../player/playerStore')
  return { loadWordBank: () => loadWordBank(source), recordMatch }
}

const weakCount = (bank: string[]) => bank.filter(hasWeakBigram).length

beforeEach(() => {
  fakeLocalStorage()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  return seedRandom(1)
})

describe('word bank for a member', () => {
  it('favors saved weak bigrams', async () => {
    supabase.current = new FakeSupabase(MEMBER, weakBigramRow())
    const { loadWordBank } = await freshStore()

    const { words: bank, source: used } = await loadWordBank()

    expect(used).toBe('supabase')
    expect(weakCount(bank)).toBeGreaterThanOrEqual(TARGETED_COUNT)
  })

  it('still favors them after logging out and back in', async () => {
    const fake = new FakeSupabase(MEMBER, weakBigramRow())
    supabase.current = fake
    const { loadWordBank } = await freshStore()
    await loadWordBank()

    fake.userId = null
    const signedOut = await loadWordBank()
    expect(signedOut.words.every(isCommonWord)).toBe(true)

    fake.userId = MEMBER
    const signedIn = await loadWordBank()
    expect(weakCount(signedIn.words)).toBeGreaterThanOrEqual(TARGETED_COUNT)
  })

  it('makes the bank it returned available to focusedBigrams', async () => {
    supabase.current = new FakeSupabase(MEMBER, weakBigramRow())
    const { loadWordBank } = await freshStore()
    const table = vi.spyOn(console, 'table').mockImplementation(() => {})
    vi.spyOn(console, 'group').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const { words: bank } = await loadWordBank()
    globalThis.focusedBigrams()

    const rows = table.mock.calls[0][0] as { bigram: string; targetedWords: string }[]
    expect(rows[0].bigram).toBe(WEAK_BIGRAM)
    expect(rows[0].targetedWords.split(', ').every((word) => bank.includes(word))).toBe(true)
  })

  it('tells focusedBigrams when stats failed to load', async () => {
    const fake = new FakeSupabase(MEMBER, weakBigramRow())
    fake.readError = { code: '500' }
    supabase.current = fake
    const { loadWordBank } = await freshStore()
    vi.spyOn(console, 'group').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await loadWordBank()
    globalThis.focusedBigrams()

    expect(String(log.mock.calls[0][0])).toContain('failed to load')
  })

  it('uses common words with no saved data', async () => {
    supabase.current = new FakeSupabase(MEMBER, playerRow(MEMBER))
    const { loadWordBank } = await freshStore()

    const { words: bank } = await loadWordBank()

    expect(bank).toHaveLength(30)
    expect(bank.every(isCommonWord)).toBe(true)
  })

  it('uses common words when stats cannot be read', async () => {
    const fake = new FakeSupabase(MEMBER, weakBigramRow())
    fake.readError = { code: '500' }
    supabase.current = fake
    const { loadWordBank } = await freshStore()

    const { words: bank, source: used } = await loadWordBank()

    expect(used).toBe('supabase')
    expect(bank.every(isCommonWord)).toBe(true)
  })

  it.each([
    ['inaccurate', { slowBigrams: {}, errorBigrams: { [WEAK_BIGRAM]: 0.5 } }],
    ['slow', { slowBigrams: { [WEAK_BIGRAM]: 300 }, errorBigrams: {} }],
  ])('learns a bigram that is %s from played matches and keeps it across a new login', async (_name, weakness) => {
    const fake = new FakeSupabase(MEMBER, playerRow(MEMBER))
    supabase.current = fake
    const typist = { ...DEFAULT_TYPIST, ...weakness }

    const { loadWordBank, recordMatch } = await freshStore()
    const firstBank = (await loadWordBank()).words
    let bank = firstBank
    for (let match = 0; match < 40; match++) {
      await recordMatch(simulateMatch(bank.map(findWord), typist), 70, 0.9)
      bank = (await loadWordBank()).words
    }

    // A new login: fresh modules, so only what reached Supabase is left.
    const relogin = await freshStore()
    const banks = await Promise.all(Array.from({ length: 5 }, () => relogin.loadWordBank()))
    const weakAfter = banks.reduce((sum, b) => sum + weakCount(b.words), 0) / banks.length

    expect(fake.saves).toHaveLength(40)
    expect(weakAfter).toBeGreaterThan(weakCount(firstBank) + 2)
  })
})
