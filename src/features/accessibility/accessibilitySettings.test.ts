import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../tests/wordEngineFixtures'
import { heatColor } from '../typing/heatmap/heatColor'

// The store reads localStorage when it loads, so each test gets a fresh copy.
async function freshStore() {
  vi.resetModules()
  return import('./accessibilitySettings')
}

describe('accessibility settings', () => {
  let storage: Map<string, string>

  beforeEach(() => {
    vi.unstubAllGlobals()
    storage = fakeLocalStorage()
  })

  it('starts with both settings off', async () => {
    const store = await freshStore()
    expect(store.getAccessibilitySettings()).toEqual({ colorblind: false, reduceMotion: false })
  })

  it('keeps both settings after a reload', async () => {
    const store = await freshStore()
    store.setAccessibilitySettings({ colorblind: true })
    store.setAccessibilitySettings({ reduceMotion: true })

    const reloaded = await freshStore()
    expect(reloaded.getAccessibilitySettings()).toEqual({ colorblind: true, reduceMotion: true })
  })

  it('ignores bad saved data', async () => {
    const { ACCESSIBILITY_STORAGE_KEY } = await freshStore()
    storage.set(ACCESSIBILITY_STORAGE_KEY, JSON.stringify({ colorblind: 'yes', reduceMotion: true, extra: 1 }))
    const store = await freshStore()
    expect(store.getAccessibilitySettings()).toEqual({ colorblind: false, reduceMotion: true })

    storage.set(ACCESSIBILITY_STORAGE_KEY, '{not json')
    const again = await freshStore()
    expect(again.getAccessibilitySettings()).toEqual({ colorblind: false, reduceMotion: false })
  })

  it('reduces motion when the setting is on, or the device asks', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    const store = await freshStore()
    expect(store.reducedMotionNow()).toBe(false)
    store.setAccessibilitySettings({ reduceMotion: true })
    expect(store.reducedMotionNow()).toBe(true)

    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    store.setAccessibilitySettings({ reduceMotion: false })
    expect(store.reducedMotionNow()).toBe(true)
  })
})

describe('heatColor', () => {
  const stats = { attempts: 4, correct: 3, accuracy: 0.75 } as Parameters<typeof heatColor>[0]

  it('blends through oklch normally and oklab in Colorblind Mode', () => {
    expect(heatColor(stats)).toContain('in oklch')
    expect(heatColor(stats, true)).toContain('in oklab')
    expect(heatColor(stats, true)).toContain(' 75%')
  })

  it('leaves untyped keys uncolored', () => {
    expect(heatColor(undefined, true)).toBeUndefined()
  })
})
