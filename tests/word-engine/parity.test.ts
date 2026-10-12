/**
 * Cross-language parity: replays every scenario exported by the Python
 * reference (word-engine-claude/parity.py) and requires identical output.
 * If this fails after an intentional engine change, change engine.py the
 * same way and re-run `python parity.py` to regenerate the fixture.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { createWordEngine } from '../../src/features/word-engine/engine.ts'
import { wordDifficulty } from '../../src/features/word-engine/difficulty.ts'
import { profileFromResults } from '../../src/features/word-engine/profile.ts'
import { createRng } from '../../src/features/word-engine/random.ts'
import type { TestResult } from '../../src/features/typing/stats/types'
import type {
  BankRequest,
  EngineConfig,
  GlobalKeyAccuracy,
  PlayerData,
} from '../../src/features/word-engine/types.ts'

interface Scenario {
  name: string
  player?: PlayerData | null
  history?: TestResult[]
  words?: string[]
  request: BankRequest
  config?: Partial<EngineConfig>
  globalKeys?: GlobalKeyAccuracy
  seed: number
  expectedProfile?: PlayerData
  expected: {
    words: string[]
    skill: number
    targetDifficulty: number
    weakKeys: string[]
    weakRatio: number
    weakWordCount: number
    keyAccuracy: Record<string, number>
  }
}

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/parity.json', import.meta.url), 'utf8'),
) as {
  defaultWords: string[]
  difficulty: Record<string, number>
  rng: { seed: number; values: number[] }
  scenarios: Scenario[]
}

describe('parity with the Python reference', () => {
  test('rng sequence', () => {
    const rng = createRng(fixture.rng.seed)
    assert.deepEqual(fixture.rng.values.map(() => rng()), fixture.rng.values)
  })

  test('difficulty ratings for every default word', () => {
    assert.deepEqual(wordDifficulty(fixture.defaultWords), fixture.difficulty)
  })

  for (const sc of fixture.scenarios) {
    test(`scenario: ${sc.name}`, () => {
      const engine = createWordEngine({ config: sc.config, globalKeys: sc.globalKeys })

      let player: PlayerData | null
      if (sc.history) {
        player = profileFromResults(sc.history)
        assert.deepEqual(player, sc.expectedProfile, 'profile')
      } else {
        player = sc.player ?? null
      }

      const result = engine.build(sc.words ?? fixture.defaultWords, player, {
        ...sc.request,
        seed: sc.seed,
      })
      const e = sc.expected
      assert.equal(result.skill, e.skill, 'skill')
      assert.equal(result.targetDifficulty, e.targetDifficulty, 'targetDifficulty')
      assert.deepEqual(result.weakKeys, e.weakKeys, 'weakKeys')
      assert.equal(result.weakRatio, e.weakRatio, 'weakRatio')
      assert.equal(result.weakWordCount, e.weakWordCount, 'weakWordCount')
      assert.deepEqual(result.keyAccuracy, e.keyAccuracy, 'keyAccuracy')
      assert.deepEqual(result.words, e.words, 'words')
    })
  }
})
