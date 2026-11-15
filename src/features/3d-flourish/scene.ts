import fontUrl from './fonts/jersey10.typeface.json?url'

/** Jersey 10 as three.js typeface JSON (see fonts/FONT-LICENSE.md). */
export const FONT_URL = fontUrl

/**
 * The scene is laid out in CSS pixels at this size and scaled to fit the
 * canvas, so 3D sizes line up with the design tokens (e.g. --fs-logo: 250px).
 */
export const DESIGN_WIDTH = 1100
export const DESIGN_HEIGHT = 460

/**
 * Typeface JSON uses an em of 100000 / 72 units at resolution 1000, so a
 * Text3D `size` of 180 draws text the size of a 250px CSS font.
 */
const EM_PER_SIZE = 100000 / 72 / 1000
export const LOGO_SIZE = 250 / EM_PER_SIZE
export const LETTER_SPACING = 4

/** Colors pulled from the design tokens in src/index.css. */
export interface Palette {
  ink: string
  inkSide: string
  keyLabel: string
  /** Label color while pressed, like the 2D .keycap.is-pressed. */
  keyLabelPressed: string
  keySide: string
}

export function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback
  return {
    ink: token('--color-ink', '#1c1410'),
    inkSide: token('--color-shade', '#4a3a2c'),
    keyLabel: token('--color-frame', '#3a2c22'),
    keyLabelPressed: token('--color-accent', '#d98e36'),
    keySide: '#866d58', // keycap.png's outer border color
  }
}
