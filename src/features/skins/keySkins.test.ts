import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../tests/wordEngineFixtures'
import { labelTone, shadedAverage, TEXTURE_CELL } from './keySkinArt'
import { KEY_SKINS } from './keySkins'
import sheetDataUrl from '../../assets/skins/key-textures.png?inline'

// The store reads localStorage when it loads, so each test gets a fresh copy.
async function freshStore() {
  vi.resetModules()
  return import('./keySkins')
}

describe('equipped keyboard skin', () => {
  beforeEach(() => {
    fakeLocalStorage()
  })

  it('starts with the default skin for everyone', async () => {
    const { getKeySkin, DEFAULT_KEY_SKIN } = await freshStore()
    expect(getKeySkin('member-1')).toBe(DEFAULT_KEY_SKIN)
  })

  it('saves each account separately and keeps them after a reload', async () => {
    const first = await freshStore()
    first.setKeySkin('member-1', 'mint')
    first.setKeySkin('member-2', 'wood')
    const reloaded = await freshStore()
    expect(reloaded.getKeySkin('member-1')).toBe('mint')
    expect(reloaded.getKeySkin('member-2')).toBe('wood')
    expect(reloaded.getKeySkin('member-3')).toBe(reloaded.DEFAULT_KEY_SKIN)
  })

  it('ignores unknown or corrupt saved skins', async () => {
    localStorage.setItem('bigwalk.keySkins', '{"member-1":"lava","member-2":"speckle"}')
    const store = await freshStore()
    expect(store.getKeySkin('member-1')).toBe(store.DEFAULT_KEY_SKIN)
    expect(store.getKeySkin('member-2')).toBe('speckle')

    localStorage.setItem('bigwalk.keySkins', 'not json')
    const corrupt = await freshStore()
    expect(corrupt.getKeySkin('member-2')).toBe(corrupt.DEFAULT_KEY_SKIN)
  })
})

describe('texture sheet', () => {
  it('has a whole cell for every skin', () => {
    // A PNG's width and height are big-endian at bytes 16 and 20.
    const png = atob(sheetDataUrl.split(',')[1])
    const uint32 = (at: number) =>
      [0, 1, 2, 3].reduce((n, i) => n * 256 + png.charCodeAt(at + i), 0)
    const width = uint32(16)
    const height = uint32(20)
    expect(width % TEXTURE_CELL).toBe(0)
    expect(height % TEXTURE_CELL).toBe(0)
    expect((width / TEXTURE_CELL) * (height / TEXTURE_CELL)).toBeGreaterThanOrEqual(
      KEY_SKINS.length,
    )
  })
})

describe('label tone', () => {
  const solid = (r: number, g: number, b: number) => [r, g, b, 255, r, g, b, 255]

  it('uses the dark label on light textures', () => {
    expect(labelTone(solid(0xe8, 0xd3, 0xc8))).toBe('dark') // Classic face
    expect(labelTone(solid(0xbf, 0xe8, 0xd4))).toBe('dark')
  })

  it('uses the light label on dark textures', () => {
    expect(labelTone(solid(0x2b, 0x33, 0x40))).toBe('light')
    expect(labelTone(solid(0x00, 0x00, 0x00))).toBe('light')
  })

  it('ignores transparent pixels', () => {
    expect(labelTone([0, 0, 0, 0, ...solid(0xff, 0xff, 0xff)])).toBe('dark')
  })
})

describe('3D side color', () => {
  it('is the average texture color darkened by the edge shade', () => {
    const pixels = [200, 100, 0, 255, 100, 50, 0, 255, 0, 0, 0, 0] // last one transparent
    expect(shadedAverage(pixels, 0)).toBe('#964b00')
    expect(shadedAverage(pixels, 0.5)).toBe('#4b2600')
  })
})
