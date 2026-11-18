import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../tests/wordEngineFixtures'
import { DEFAULT_FONT, FONTS, SIZE_REFERENCE_FONT, findFont, fontFamilyValue, fontStylesheetUrl } from './fonts'
import { absoluteUrls, widthScale } from './loadFont'

describe('font list', () => {
  it('includes the default and size reference fonts', () => {
    expect(findFont(DEFAULT_FONT)).toBeDefined()
    expect(findFont(SIZE_REFERENCE_FONT)).toBeDefined()
  })

  it('has no duplicate names', () => {
    const names = FONTS.map((font) => font.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('builds the Google Fonts URL from the name', () => {
    expect(fontStylesheetUrl({ name: 'Roboto Slab', fallback: 'serif' })).toBe(
      'https://fonts.googleapis.com/css2?family=Roboto+Slab&display=block',
    )
  })

  it('uses a font\'s own URL when it has one', () => {
    const url = 'https://example.com/font.css'
    expect(fontStylesheetUrl({ name: 'Mine', fallback: 'serif', url })).toBe(url)
  })

  it('puts the fallback after the font', () => {
    expect(fontFamilyValue({ name: 'Jersey 10', fallback: 'monospace' })).toBe("'Jersey 10', monospace")
  })
})

describe('font scaling', () => {
  it('shrinks wider fonts and grows narrower ones to the reference width', () => {
    expect(widthScale(1000, 2000)).toBe(0.5)
    expect(widthScale(1000, 800)).toBe(1.25)
    expect(widthScale(1000, 1000)).toBe(1)
  })

  it('leaves the size alone when a width could not be measured', () => {
    expect(widthScale(0, 500)).toBe(1)
    expect(widthScale(500, 0)).toBe(1)
  })

  it('makes stylesheet URLs absolute so fonts load from the font service', () => {
    const base = 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5/index.css'
    expect(absoluteUrls("src: url(./files/a.woff2) format('woff2'), url('b.woff')", base)).toBe(
      `src: url("https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5/files/a.woff2") format('woff2'), ` +
        'url("https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5/b.woff")',
    )
    expect(absoluteUrls('url(https://fonts.gstatic.com/x.woff2)', base)).toBe('url("https://fonts.gstatic.com/x.woff2")')
  })
})

describe('font settings', () => {
  // The store reads localStorage when it loads, so each test gets a fresh copy.
  async function freshSettings() {
    vi.resetModules()
    return import('./fontSettings')
  }

  // These tests run without a DOM or network: fonts fail to load (as if the
  // font service were down), which leaves just the CSS variables to check.
  // Loading and scaling real fonts is checked in the browser.
  let cssVars: Map<string, string>

  beforeEach(() => {
    fakeLocalStorage()
    cssVars = new Map()
    vi.stubGlobal('document', {
      documentElement: { style: { setProperty: (name: string, value: string) => cssVars.set(name, value) } },
    })
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('saves choices and reads them back after a reload', async () => {
    const first = await freshSettings()
    first.setFontSettings({ typing: 'OpenDyslexic' })
    first.setFontSettings({ menu: 'Roboto Slab' })
    const reloaded = await freshSettings()
    expect(reloaded.getFontSettings()).toEqual({ menu: 'Roboto Slab', typing: 'OpenDyslexic' })
  })

  it('refuses names that are not in the list', async () => {
    const { getFontSettings, setFontSettings } = await freshSettings()
    setFontSettings({ menu: 'Comic Sans' })
    expect(getFontSettings().menu).toBe(DEFAULT_FONT)
  })

  it('points the CSS variables at the chosen fonts, even if they fail to load', async () => {
    const { applyFontSettings, setFontSettings } = await freshSettings()
    await applyFontSettings()
    expect(cssVars.get('--font')).toBe("'Jersey 10', monospace")
    expect(cssVars.get('--font-typing')).toBe("'Jersey 10', monospace")

    setFontSettings({ typing: 'Cascadia Mono' })
    await applyFontSettings()
    expect(cssVars.get('--font')).toBe("'Jersey 10', monospace")
    expect(cssVars.get('--font-typing')).toBe("'Cascadia Mono', monospace")
    expect(console.warn).toHaveBeenCalled()
  })

  it('starts on the default font for both', async () => {
    const { getFontSettings } = await freshSettings()
    expect(getFontSettings()).toEqual({ menu: DEFAULT_FONT, typing: DEFAULT_FONT })
  })

  it('ignores saved names that are no longer in the list', async () => {
    localStorage.setItem('bigwalk.fontSettings', '{"menu":"Comic Sans","typing":"Roboto Slab"}')
    expect((await freshSettings()).getFontSettings()).toEqual({ menu: DEFAULT_FONT, typing: 'Roboto Slab' })
    localStorage.setItem('bigwalk.fontSettings', 'not json')
    expect((await freshSettings()).getFontSettings()).toEqual({ menu: DEFAULT_FONT, typing: DEFAULT_FONT })
  })
})
