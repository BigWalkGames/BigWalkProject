import { vi } from 'vitest'
import { words, type ItemStats, type Word } from '../features/word-engine'

export const COMMON_POOL_SIZE = 3000

// A real bigram with enough words (139) to fill the targeted share of several banks.
export const WEAK_BIGRAM = 'ck'

export const hasWeakBigram = (word: string) => word.includes(WEAK_BIGRAM)

export function isCommonWord(word: string): boolean {
  return words.slice(0, COMMON_POOL_SIZE).some((w) => w.word === word)
}

export function itemStats(overrides: Partial<ItemStats> = {}): ItemStats {
  return { ewmaLatency: 100, latencySamples: 50, ewmaErrorRate: 0, errorSamples: 50, ...overrides }
}

// Stats for every bigram in the common pool, all equally strong unless overridden.
export function savedBigramStats(overrides: Record<string, Partial<ItemStats>> = {}): Record<string, ItemStats> {
  const stats: Record<string, ItemStats> = {}
  for (const word of words.slice(0, COMMON_POOL_SIZE)) {
    for (const bigram of word.bigrams) stats[bigram] = itemStats(overrides[bigram])
  }
  return stats
}

export function findWord(word: string): Word {
  const found = words.find((w) => w.word === word)
  if (!found) throw new Error(`Not in the word list: ${word}`)
  return found
}

// Makes Math.random repeatable, so sampled banks can't make a test flaky (mulberry32).
// Not a vi.spyOn: recording millions of calls runs out of memory. Returns the restore function.
export function seedRandom(seed: number): () => void {
  const original = Math.random
  let state = seed
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => {
    Math.random = original
  }
}

export function fakeLocalStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  return store
}

export interface PlayerRow {
  account_id: string
  net_wpm: number
  net_accuracy: number
  bigram_stats: Record<string, ItemStats>
  key_stats: Record<string, ItemStats>
}

export function playerRow(account_id: string, overrides: Partial<PlayerRow> = {}): PlayerRow {
  return { account_id, net_wpm: 70, net_accuracy: 0.9, bigram_stats: {}, key_stats: {}, ...overrides }
}

interface SaveArgs {
  acc_id: string
  bigrams: Record<string, ItemStats>
  keys: Record<string, ItemStats>
}

// Stands in for Supabase: one signed-in user and the two player stats functions.
export class FakeSupabase {
  userId: string | null
  row: PlayerRow | null
  readError: { code: string } | null = null
  saveError: { code: string } | null = null
  reads = 0
  saves: SaveArgs[] = []

  constructor(userId: string | null, row: PlayerRow | null = null) {
    this.userId = userId
    this.row = row
  }

  auth = {
    getUser: async () => ({ data: { user: this.userId ? { id: this.userId } : null } }),
  }

  rpc = async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'get_player_stats') {
      this.reads++
      if (this.readError) return { data: null, error: this.readError }
      return { data: this.row ? [this.row] : [], error: null }
    }
    if (fn === 'update_player_stats') {
      const save = args as unknown as SaveArgs
      this.saves.push(save)
      if (this.saveError) return { data: null, error: this.saveError }
      this.row = {
        ...(this.row ?? playerRow(save.acc_id)),
        bigram_stats: save.bigrams,
        key_stats: save.keys,
      }
      return { data: null, error: null }
    }
    throw new Error(`Unexpected rpc: ${fn}`)
  }
}
