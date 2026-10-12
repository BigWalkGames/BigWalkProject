import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { createWordEngine } from '../../src/features/word-engine/engine.ts'
import { LETTERS } from '../../src/features/word-engine/letters.ts'
import { WordEngineError, type PlayerData } from '../../src/features/word-engine/types.ts'

const WORDS: string[] = JSON.parse(
  readFileSync(new URL('./fixtures/parity.json', import.meta.url), 'utf8'),
).defaultWords

/** Every letter at `acc` over 40 attempts, with some letters overridden. */
function player(wpm: number, acc: number, overrides: Record<string, number> = {}): PlayerData {
  const perKey: Record<string, { attempts: number; correct: number }> = {}
  for (const letter of LETTERS) {
    perKey[letter] = { attempts: 40, correct: Math.round((overrides[letter] ?? acc) * 40) }
  }
  return { wpm, accuracy: acc, perKey }
}

const raw = createWordEngine({ config: { priorAttempts: 0 } })
const engine = createWordEngine()

describe('skill level', () => {
  test('spans 0 to 100', () => {
    assert.equal(raw.skillLevel(player(0, 0)), 0)
    assert.equal(raw.skillLevel(player(120, 1)), 100)
    assert.equal(raw.skillLevel(player(500, 1)), 100) // WPM capped
  })

  test('accuracy at or below the floor scores zero', () => {
    assert.equal(raw.skillLevel(player(60, 0.75)), 25)
    assert.equal(raw.skillLevel(player(60, 0.5)), 25)
  })

  test('rises with WPM and with accuracy', () => {
    assert.ok(raw.skillLevel(player(40, 0.9)) < raw.skillLevel(player(60, 0.9)))
    assert.ok(raw.skillLevel(player(60, 0.85)) < raw.skillLevel(player(60, 0.95)))
  })

  test('fast but sloppy does not outrank careful', () => {
    assert.ok(raw.skillLevel(player(105, 0.8)) <= raw.skillLevel(player(45, 0.95)))
  })

  test('new player gets a mid-range skill', () => {
    const skill = engine.skillLevel(null)
    assert.ok(skill > 30 && skill < 60, String(skill))
  })

  test('a TestResult-shaped object works as player data', () => {
    const result = {
      wpm: 50, rawWpm: 55, accuracy: 0.9, durationMs: 30000, keystrokes: [],
      wordBankSource: 'fallback', completedAt: '2026-10-11T00:00:00Z',
      perKey: { q: { attempts: 5, correct: 1, accuracy: 0.2, mistypedAs: { a: 4 } } },
    }
    assert.equal(engine.weakKeys(engine.keyAccuracy(result))[0], 'q')
  })
})

describe('key accuracy and weak keys', () => {
  test('smoothing damps low-sample letters', () => {
    const acc = engine.keyAccuracy({
      wpm: 50, accuracy: 0.95,
      perKey: { q: { attempts: 2, correct: 0 }, z: { attempts: 200, correct: 0 } },
    })
    assert.ok(acc.q > 0.7)
    assert.ok(acc.z < 0.1)
  })

  test('global data fills untyped letters only', () => {
    const e = createWordEngine({ globalKeys: { q: 0.5, w: 0.5 } })
    const acc = e.keyAccuracy({ wpm: 50, accuracy: 0.95, perKey: { w: { attempts: 40, correct: 38 } } })
    assert.equal(acc.q, 0.5) // never typed: global
    assert.ok(acc.w > 0.9) // typed: the player's own data wins
  })

  test('even accuracy means no weak keys', () => {
    assert.deepEqual(engine.weakKeys(engine.keyAccuracy(player(60, 0.95))), [])
  })

  test('ignores space and other non-letters', () => {
    const acc = engine.keyAccuracy({ wpm: 50, accuracy: 0.9, perKey: { ' ': { attempts: 50, correct: 1 } } })
    assert.deepEqual(Object.keys(acc), [...LETTERS])
  })
})

describe('word bank', () => {
  test('20 unique words from the collection by default', () => {
    const words = engine.select(WORDS, player(50, 0.9, { q: 0.5 }), { seed: 1 })
    assert.equal(words.length, 20)
    assert.equal(new Set(words).size, 20)
    assert.ok(words.every((w) => WORDS.includes(w)))
  })

  test('count is adjustable', () => {
    for (const count of [1, 10, 50]) {
      assert.equal(engine.select(WORDS, player(50, 0.9), { count, seed: 1 }).length, count)
    }
  })

  test('same seed, same bank; no seed, varied banks', () => {
    const p = player(50, 0.9, { q: 0.5 })
    assert.deepEqual(engine.select(WORDS, p, { seed: 7 }), engine.select(WORDS, p, { seed: 7 }))
    const banks = new Set(Array.from({ length: 5 }, () => engine.select(WORDS, p).join(' ')))
    assert.ok(banks.size > 1)
  })

  test('higher skill gets harder words', () => {
    const slow = engine.build(WORDS, player(20, 0.8), { seed: 3 })
    const fast = engine.build(WORDS, player(110, 0.98), { seed: 3 })
    assert.ok(slow.meanDifficulty < fast.meanDifficulty)
  })

  test('difficulty classes shift the target', () => {
    const p = player(55, 0.92)
    const easy = engine.build(WORDS, p, { difficulty: 'easy', seed: 3 })
    const hard = engine.build(WORDS, p, { difficulty: 'hard', seed: 3 })
    assert.equal(Math.round(hard.targetDifficulty - easy.targetDifficulty), 40)
    assert.ok(easy.meanDifficulty < hard.meanDifficulty)
  })

  test('absolute target overrides the class', () => {
    const r = engine.build(WORDS, player(120, 1), { targetDifficulty: 10, difficulty: 'hard', seed: 1 })
    assert.equal(r.targetDifficulty, 10)
    assert.ok(r.meanDifficulty < 30)
  })

  test('weak keys show up in the bank', () => {
    const r = engine.build(WORDS, player(60, 0.95, { z: 0.4, q: 0.5 }), { seed: 5 })
    assert.equal(r.weakKeys[0], 'z')
    assert.ok(r.weakWordCount > 0)
    const hits = r.words.filter((w) => r.weakKeys.some((k) => w.includes(k)))
    assert.ok(hits.length >= r.weakWordCount)
  })

  test('avoid leaves out the previous bank', () => {
    const p = player(55, 0.92, { j: 0.7 })
    const first = engine.select(WORDS, p, { seed: 1 })
    const second = engine.select(WORDS, p, { seed: 2, avoid: first })
    assert.equal(second.filter((w) => first.includes(w)).length, 0)
  })

  test('avoid is ignored when too few words would remain', () => {
    const words = ['cat', 'dog', 'owl', 'yak']
    assert.equal(engine.select(words, player(50, 0.9), { count: 3, avoid: words, seed: 1 }).length, 3)
  })

  test('small collections return what they have', () => {
    assert.deepEqual(engine.select(['cat', 'dog', 'owl'], player(50, 0.9), { seed: 1 }).sort(), ['cat', 'dog', 'owl'])
  })

  test('messy words are filtered and deduplicated', () => {
    const words = engine.select(['cat', 'cat', "don't", 'Dog', '', 'x1', 'owl'], null, { seed: 1 })
    assert.deepEqual([...words].sort(), ['cat', 'owl'])
  })
})

describe('errors', () => {
  const cases: [string, () => unknown][] = [
    ['accuracy > 1', () => engine.build(WORDS, { ...player(50, 0.9), accuracy: 1.2 })],
    ['negative wpm', () => engine.build(WORDS, player(-1, 0.9))],
    ['correct > attempts', () => engine.build(WORDS, { wpm: 50, accuracy: 0.9, perKey: { a: { attempts: 1, correct: 2 } } })],
    ['unknown difficulty', () => engine.build(WORDS, null, { difficulty: 'nightmare' })],
    ['target out of range', () => engine.build(WORDS, null, { targetDifficulty: 150 })],
    ['count 0', () => engine.build(WORDS, null, { count: 0 })],
    ['no usable words', () => engine.build(['123', ''], null)],
    ['bad config', () => createWordEngine({ config: { accuracyFloor: 1 } })],
    ['bad global data', () => createWordEngine({ globalKeys: { q: 2 } })],
  ]
  for (const [name, run] of cases) {
    test(name, () => assert.throws(run, WordEngineError))
  }
})
