import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { TestResult } from '../../src/features/typing/stats/types'
import type { LoadedWordBank } from '../../src/features/typing/wordbank/types'
import {
  createAdaptiveWordBankLoader,
  type AdaptiveBankInfo,
} from '../../src/features/word-engine/adaptiveWordBank.ts'
import { createWordEngine } from '../../src/features/word-engine/engine.ts'
import {
  combineStatsSinks,
  createLocalPlayerHistory,
  type StorageLike,
} from '../../src/features/word-engine/history.ts'
import { profileFromResults } from '../../src/features/word-engine/profile.ts'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

function result(minute: number, wpm: number, perKey: TestResult['perKey'] = {}): TestResult {
  return {
    durationMs: 30000, wpm, rawWpm: wpm, accuracy: 0.9, perKey,
    keystrokes: [{ expected: 'a', typed: 'a', correct: true, t: 5 }],
    wordBankSource: 'fallback',
    completedAt: `2026-10-11T18:${String(minute).padStart(2, '0')}:00.000Z`,
  }
}

const keyStats = (attempts: number, correct: number) => ({
  attempts, correct, accuracy: correct / attempts, mistypedAs: {},
})

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india',
  'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra',
  'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu', 'apple', 'quiz', 'jazz',
  'zebra', 'quick', 'jumpy', 'vex', 'box', 'wax', 'kept', 'yolk', 'fizz', 'buzz', 'jinx']

describe('profileFromResults', () => {
  test('no history is null', () => {
    assert.equal(profileFromResults([]), null)
  })

  test('sums counts and weights WPM by length', () => {
    const p = profileFromResults(
      [result(0, 40, { q: keyStats(2, 1), ' ': keyStats(8, 8) }), result(5, 60, { q: keyStats(8, 8) })],
      { decay: 1 },
    )
    assert.equal(p?.wpm, 50)
    assert.deepEqual(p?.perKey.q, { attempts: 10, correct: 9 })
    assert.equal(p?.accuracy, 17 / 18)
  })

  test('recent results count more, regardless of input order', () => {
    const p = profileFromResults([result(5, 80, { q: keyStats(10, 10) }), result(0, 20, { q: keyStats(10, 0) })], { decay: 0.5 })
    assert.equal(p?.wpm, 60) // (80*1 + 20*0.5) / 1.5
    assert.equal((p!.perKey.q!.correct / p!.perKey.q!.attempts).toFixed(4), (2 / 3).toFixed(4))
  })

  test('only the newest maxResults count', () => {
    const rs = [10, 10, 80, 80].map((wpm, i) => result(i, wpm))
    assert.equal(profileFromResults(rs, { maxResults: 2 })?.wpm, 80)
  })
})

describe('createLocalPlayerHistory', () => {
  test('saves, reads back newest last, and drops keystrokes', async () => {
    const storage = memoryStorage()
    const history = createLocalPlayerHistory(storage)
    await history.saveResult(result(1, 30))
    await history.saveResult(result(2, 40))
    const back = await history.getRecentResults(10)
    assert.deepEqual(back.map((r) => r.wpm), [30, 40])
    assert.deepEqual(back[0].keystrokes, [])
    assert.equal(history.count(), 2)
  })

  test('caps stored results and honours limit', async () => {
    const history = createLocalPlayerHistory(memoryStorage(), { maxStored: 3 })
    for (let i = 0; i < 5; i += 1) await history.saveResult(result(i, i))
    assert.deepEqual((await history.getRecentResults(10)).map((r) => r.wpm), [2, 3, 4])
    assert.deepEqual((await history.getRecentResults(2)).map((r) => r.wpm), [3, 4])
  })

  test('clear forgets everything', async () => {
    const history = createLocalPlayerHistory(memoryStorage())
    await history.saveResult(result(1, 30))
    history.clear()
    assert.equal(history.count(), 0)
  })

  test('corrupted or missing storage behaves as no history', async () => {
    const storage = memoryStorage()
    storage.setItem('bigwalk.wordEngine.history.v1', '{not json')
    assert.deepEqual(await createLocalPlayerHistory(storage).getRecentResults(5), [])
    const none = createLocalPlayerHistory(() => undefined)
    assert.deepEqual(await none.getRecentResults(5), [])
    await assert.rejects(none.saveResult(result(1, 30)))
  })

  test('combineStatsSinks saves to every sink', async () => {
    const a = createLocalPlayerHistory(memoryStorage())
    const b = createLocalPlayerHistory(memoryStorage())
    await combineStatsSinks(a, b).saveResult(result(1, 30))
    assert.equal(a.count() + b.count(), 2)
  })
})

describe('createAdaptiveWordBankLoader', () => {
  const engine = createWordEngine()
  const loadWords = async (): Promise<LoadedWordBank> => ({ words: WORDS, source: 'fallback' })

  test('builds from history and reports what it did', async () => {
    const history = createLocalPlayerHistory(memoryStorage())
    await history.saveResult(result(1, 45, { q: keyStats(20, 4), e: keyStats(40, 39) }))
    const infos: AdaptiveBankInfo[] = []
    const loader = createAdaptiveWordBankLoader({
      engine, loadWords, history, request: { count: 10 }, onResult: (i) => infos.push(i),
    })

    const bank = await loader.load()
    assert.equal(bank.source, 'fallback')
    assert.equal(bank.words.length, 10)
    assert.equal(infos[0].historyCount, 1)
    assert.equal(infos[0].result?.weakKeys[0], 'q')
    assert.deepEqual(loader.lastBank(), bank.words)
  })

  test('consecutive banks avoid repeats', async () => {
    const loader = createAdaptiveWordBankLoader({ engine, loadWords, request: { count: 10 } })
    const first = await loader.load()
    const second = await loader.load()
    assert.equal(second.words.filter((w) => first.words.includes(w)).length, 0)
  })

  test('the loop: a saved result changes the next bank', async () => {
    const history = createLocalPlayerHistory(memoryStorage())
    const skills: number[] = []
    const loader = createAdaptiveWordBankLoader({
      engine, loadWords, history, onResult: (i) => skills.push(i.result!.skill),
    })
    await loader.load() // new player
    await history.saveResult(result(1, 110, Object.fromEntries('abcdefghijklmnopqrstuvwxyz'
      .split('').map((k) => [k, keyStats(40, 40)]))))
    await loader.load() // now a fast, accurate player
    assert.ok(skills[1] > skills[0] + 20, String(skills))
  })

  test('history failure: still builds, as a new player', async () => {
    const infos: AdaptiveBankInfo[] = []
    const loader = createAdaptiveWordBankLoader({
      engine, loadWords,
      history: { getRecentResults: () => Promise.reject(new Error('offline')) },
      onResult: (i) => infos.push(i),
    })
    const bank = await loader.load()
    assert.equal(bank.words.length, 20)
    assert.equal(infos[0].player, null)
    assert.ok(infos[0].error instanceof Error)
  })

  test('engine failure: falls back to the plain words', async () => {
    const infos: AdaptiveBankInfo[] = []
    const loader = createAdaptiveWordBankLoader({
      engine, loadWords, request: { difficulty: 'nightmare' }, onResult: (i) => infos.push(i),
    })
    const bank = await loader.load()
    assert.deepEqual(bank.words, WORDS)
    assert.equal(infos[0].result, null)
  })

  test('request may be a function, read on every load', async () => {
    let count = 5
    const loader = createAdaptiveWordBankLoader({ engine, loadWords, request: () => ({ count }) })
    assert.equal((await loader.load()).words.length, 5)
    count = 8
    assert.equal((await loader.load()).words.length, 8)
  })
})
