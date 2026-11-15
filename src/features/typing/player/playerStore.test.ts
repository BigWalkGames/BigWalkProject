import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Keystroke, PlayerData } from '../../word-engine'
import { FakeSupabase, fakeLocalStorage, itemStats, playerRow } from '../../../tests/wordEngineFixtures'
import { loadPlayer, recordMatch } from './playerStore'

const supabase = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('../../../lib/supabase', () => ({ getSupabase: () => supabase.current }))

const MEMBER = 'member-1'
const LOCAL_KEY = `bigwalk.player.${MEMBER}`

const log: Keystroke[] = [
  { expected: 't', typed: 't', latencyMs: 400, wordIndex: 0, charIndex: 0 },
  { expected: 'h', typed: 'h', latencyMs: 150, wordIndex: 0, charIndex: 1 },
  { expected: 'e', typed: 'e', latencyMs: 150, wordIndex: 0, charIndex: 2 },
]

const th = (samples: number) => ({ th: itemStats({ latencySamples: samples, errorSamples: samples }) })

function useSupabase(fake: FakeSupabase): FakeSupabase {
  supabase.current = fake
  return fake
}

function localPlayer(samples: number): string {
  const player: PlayerData = { userId: MEMBER, netWpm: 1, netAccuracy: 1, bigramStats: th(samples), keyStats: {} }
  return JSON.stringify(player)
}

let storage: Map<string, string>

beforeEach(() => {
  storage = fakeLocalStorage()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('signed-out players', () => {
  it('stay in localStorage and keep their last-match numbers', async () => {
    const fake = useSupabase(new FakeSupabase(null))

    await recordMatch(log, 55, 0.8)
    const player = await loadPlayer()

    expect(fake.reads).toBe(0)
    expect(fake.saves).toEqual([])
    expect(player).toMatchObject({ userId: 'local', netWpm: 55, netAccuracy: 0.8 })
    expect(player.bigramStats.th).toBeDefined()
  })
})

describe('members', () => {
  it('save to Supabase and leave nothing locally', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER)))

    await recordMatch(log, 55, 0.8)

    expect(fake.saves).toHaveLength(1)
    expect(fake.saves[0].acc_id).toBe(MEMBER)
    expect(fake.saves[0].bigrams.th).toBeDefined()
    expect(fake.saves[0].keys.h).toBeDefined()
    expect(storage.has(LOCAL_KEY)).toBe(false)
  })

  it('start empty with no saved row', async () => {
    useSupabase(new FakeSupabase(MEMBER))
    expect(await loadPlayer()).toEqual({
      userId: MEMBER,
      netWpm: 0,
      netAccuracy: 0,
      bigramStats: {},
      keyStats: {},
    })
  })

  it('add to their saved stats instead of replacing them', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER, { bigram_stats: th(5) })))

    await recordMatch(log, 55, 0.8)

    expect(fake.saves[0].bigrams.th.latencySamples).toBe(6)
  })

  it('get their all-time averages, not their last match', async () => {
    useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER, { net_wpm: 70, net_accuracy: 0.9 })))

    await recordMatch(log, 200, 0.1)

    expect(await loadPlayer()).toMatchObject({ netWpm: 70, netAccuracy: 0.9 })
  })

  it('never send net stats to Supabase', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER)))

    await recordMatch(log, 200, 0.1)

    expect(Object.keys(fake.saves[0]).sort()).toEqual(['acc_id', 'bigrams', 'keys'])
  })

  it('load the same stats after logging out and back in', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER)))
    await recordMatch(log, 55, 0.8)
    const saved = (await loadPlayer()).bigramStats

    fake.userId = null
    expect((await loadPlayer()).bigramStats).toEqual({})

    fake.userId = MEMBER
    expect((await loadPlayer()).bigramStats).toEqual(saved)
  })

  it('wait for a pending save before loading', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER)))

    void recordMatch(log, 55, 0.8)
    const player = await loadPlayer()

    expect(fake.saves).toHaveLength(1)
    expect(player.bigramStats.th).toBeDefined()
  })
})

describe('local copies of member stats', () => {
  it('upload once and clear when they have more samples', async () => {
    storage.set(LOCAL_KEY, localPlayer(50))
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER)))

    const player = await loadPlayer()

    expect(fake.saves).toHaveLength(1)
    expect(fake.saves[0].bigrams.th.latencySamples).toBe(50)
    expect(player).toMatchObject({ netWpm: 70, bigramStats: th(50) })
    expect(storage.has(LOCAL_KEY)).toBe(false)
  })

  it('never overwrite Supabase when they have fewer samples', async () => {
    storage.set(LOCAL_KEY, localPlayer(2))
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER, { bigram_stats: th(50) })))

    const player = await loadPlayer()

    expect(fake.saves).toEqual([])
    expect(player.bigramStats).toEqual(th(50))
    expect(storage.has(LOCAL_KEY)).toBe(false)
  })
})

describe('Supabase failures', () => {
  it('keep a failed save locally, then sync it on the next load', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER, { bigram_stats: th(5) })))
    fake.saveError = { code: '500' }

    await recordMatch(log, 55, 0.8)
    expect(storage.has(LOCAL_KEY)).toBe(true)

    fake.saveError = null
    const player = await loadPlayer()

    expect(fake.row?.bigram_stats.th.latencySamples).toBe(6)
    expect(player.bigramStats.th.latencySamples).toBe(6)
    expect(storage.has(LOCAL_KEY)).toBe(false)
  })

  it('never save over stats that could not be read', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER, playerRow(MEMBER, { bigram_stats: th(500) })))
    fake.readError = { code: '500' }

    await recordMatch(log, 55, 0.8)

    expect(fake.saves).toEqual([])
    expect(storage.has(LOCAL_KEY)).toBe(true)

    fake.readError = null
    const player = await loadPlayer()

    expect(fake.saves).toEqual([])
    expect(player.bigramStats).toEqual(th(500))
    expect(storage.has(LOCAL_KEY)).toBe(false)
  })

  it('make loadPlayer reject when stats cannot be read', async () => {
    const fake = useSupabase(new FakeSupabase(MEMBER))
    fake.readError = { code: '500' }

    await expect(loadPlayer()).rejects.toEqual({ code: '500' })
  })
})
