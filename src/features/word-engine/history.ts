import type { StatsSink, TestResult } from '../typing/stats/types'

/**
 * Where the engine reads a player's past results from. The MVP uses
 * browser storage (createLocalPlayerHistory); a Supabase-backed version can
 * replace it later without touching the engine; only this interface matters.
 */
export interface PlayerHistory {
  /** Up to `limit` of the player's most recent results, any order. May reject. */
  getRecentResults(limit: number): Promise<TestResult[]>
}

/** The bits of the Web Storage API we use (window.localStorage fits). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LocalPlayerHistory extends PlayerHistory, StatsSink {
  /** Number of stored results. */
  count(): number
  /** Forget every stored result (the next bank is built as for a new player). */
  clear(): void
}

export interface LocalHistoryOptions {
  /** Storage key. Default 'bigwalk.wordEngine.history.v1'. */
  key?: string
  /** Oldest results are dropped beyond this. Default 50. */
  maxStored?: number
}

/**
 * Keeps results in browser storage. It is both a PlayerHistory (the engine
 * reads from it) and a StatsSink (the typing test saves into it), so one
 * object closes the loop: finish a test -> next bank adapts.
 *
 * The raw keystroke log is dropped before saving to keep storage small; the
 * engine only needs the aggregate stats.
 *
 * `storage` may be a getter so this can be created at module load, before
 * (or without) a browser; with no storage, reads return [] and saves reject.
 */
export function createLocalPlayerHistory(
  storage: StorageLike | (() => StorageLike | undefined),
  { key = 'bigwalk.wordEngine.history.v1', maxStored = 50 }: LocalHistoryOptions = {},
): LocalPlayerHistory {
  const getStorage = typeof storage === 'function' ? storage : () => storage

  function readAll(): TestResult[] {
    try {
      const raw = getStorage()?.getItem(key)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(isStoredResult) : []
    } catch {
      return [] // unavailable storage or corrupted data: behave as no history
    }
  }

  return {
    async getRecentResults(limit) {
      return readAll().slice(-limit)
    },

    async saveResult(result) {
      const store = getStorage()
      if (!store) throw new Error('browser storage is unavailable')
      const all = readAll()
      all.push({ ...result, keystrokes: [] })
      store.setItem(key, JSON.stringify(all.slice(-maxStored)))
    },

    count: () => readAll().length,

    clear() {
      getStorage()?.removeItem(key)
    },
  }
}

/** Saves each result to every sink; rejects if any of them fails. */
export function combineStatsSinks(...sinks: StatsSink[]): StatsSink {
  return {
    async saveResult(result) {
      await Promise.all(sinks.map((sink) => sink.saveResult(result)))
    },
  }
}

function isStoredResult(value: unknown): value is TestResult {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.wpm === 'number' &&
    typeof r.accuracy === 'number' &&
    typeof r.durationMs === 'number' &&
    typeof r.completedAt === 'string' &&
    typeof r.perKey === 'object' &&
    r.perKey !== null
  )
}
