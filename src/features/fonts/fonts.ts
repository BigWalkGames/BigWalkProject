/**
 * The fonts players can pick for menus and for typing (Settings > Gameplay).
 * See README.md in this folder for how to add one.
 */
export interface FontOption {
  /** The font's family name. Shown in the dropdowns and saved as the player's choice. */
  name: string
  /** Generic family shown while the font loads, or if it can't load. */
  fallback: 'serif' | 'sans-serif' | 'monospace'
  /**
   * Stylesheet that declares the font's @font-face. Leave it out for Google
   * Fonts: the URL is built from `name`.
   */
  url?: string
}

export const FONTS: readonly FontOption[] = [
  { name: 'Jersey 10', fallback: 'monospace' },
  { name: 'Roboto Slab', fallback: 'serif' },
  { name: 'Cascadia Mono', fallback: 'monospace' },
  // Not on Google Fonts, so it comes from Fontsource's copy on jsDelivr.
  { name: 'OpenDyslexic', fallback: 'sans-serif', url: 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5/index.css' },
]

/** Used for both menus and typing until the player picks something else. */
export const DEFAULT_FONT = 'Jersey 10'

/**
 * The font the app's sizes were designed for. Every other font is scaled to
 * take up about as much room as this one (see loadFont.ts).
 */
export const SIZE_REFERENCE_FONT = 'Jersey 10'

export function findFont(name: unknown): FontOption | undefined {
  return FONTS.find((font) => font.name === name)
}

/** The font's stylesheet: its own `url`, or the Google Fonts one for its name. */
export function fontStylesheetUrl(font: FontOption): string {
  if (font.url) return font.url
  const family = encodeURIComponent(font.name).replace(/%20/g, '+')
  return `https://fonts.googleapis.com/css2?family=${family}&display=block`
}

/** CSS font-family value: the font, then its fallback. */
export function fontFamilyValue(font: FontOption): string {
  return `'${font.name}', ${font.fallback}`
}
