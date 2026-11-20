import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../tests/wordEngineFixtures'

// The store reads localStorage when it loads, so each test gets a fresh copy.
async function freshStore() {
  vi.resetModules()
  return import('./timeAttackLength')
}

describe('Time Attack length', () => {
  let storage: Map<string, string>

  beforeEach(() => {
    vi.unstubAllGlobals()
    storage = fakeLocalStorage()
  })

  it('starts at 30 seconds', async () => {
    const store = await freshStore()
    expect(store.getTimeAttackLength()).toBe(30)
  })

  it('accepts only 15, 30 and 60', async () => {
    const store = await freshStore()
    for (const length of [15, 60, 30]) {
      store.setTimeAttackLength(length)
      expect(store.getTimeAttackLength()).toBe(length)
    }
    store.setTimeAttackLength(45)
    store.setTimeAttackLength(0)
    store.setTimeAttackLength(Number.NaN)
    expect(store.getTimeAttackLength()).toBe(30)
  })

  it('remembers the last pick after a reload', async () => {
    const store = await freshStore()
    store.setTimeAttackLength(60)
    const reloaded = await freshStore()
    expect(reloaded.getTimeAttackLength()).toBe(60)
  })

  it('falls back to 30 for bad saved data', async () => {
    const { TIME_ATTACK_LENGTH_STORAGE_KEY } = await freshStore()
    storage.set(TIME_ATTACK_LENGTH_STORAGE_KEY, '45')
    expect((await freshStore()).getTimeAttackLength()).toBe(30)
    storage.set(TIME_ATTACK_LENGTH_STORAGE_KEY, 'abc')
    expect((await freshStore()).getTimeAttackLength()).toBe(30)
  })
})
