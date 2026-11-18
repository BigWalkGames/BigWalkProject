import { useSyncExternalStore } from 'react'
import { DEFAULT_FONT, findFont, fontFamilyValue } from './fonts'
import { loadFont } from './loadFont'

/** Font names (from FONTS) for the two places text appears. Saved on this device. */
export interface FontSettings {
  /** Everything except the words being typed: menus, buttons, HUD, results. */
  menu: string
  /** The words in a match and the results word bank. */
  typing: string
}

const STORAGE_KEY = 'bigwalk.fontSettings'
export const DEFAULT_FONT_SETTINGS: FontSettings = { menu: DEFAULT_FONT, typing: DEFAULT_FONT }

/** `name` if it's still in FONTS, otherwise `fallback`, so a removed or edited value can't stick. */
function known(name: unknown, fallback: string): string {
  return findFont(name)?.name ?? fallback
}

function read(): FontSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<keyof FontSettings, unknown>>
      return {
        menu: known(saved.menu, DEFAULT_FONT_SETTINGS.menu),
        typing: known(saved.typing, DEFAULT_FONT_SETTINGS.typing),
      }
    }
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return DEFAULT_FONT_SETTINGS
}

let current = read()
const listeners = new Set<() => void>()

export function getFontSettings(): FontSettings {
  return current
}

export function setFontSettings(patch: Partial<FontSettings>) {
  current = {
    menu: known(patch.menu ?? current.menu, current.menu),
    typing: known(patch.typing ?? current.typing, current.typing),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage full or unavailable: the choice lasts until reload.
  }
  void applyFontSettings()
  for (const listener of listeners) listener()
}

export function subscribeFontSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFontSettings(): FontSettings {
  return useSyncExternalStore(subscribeFontSettings, () => current)
}

/** Bumped on every apply, so a slow font finishing late can't undo a newer choice. */
let applyCount = 0

/**
 * Loads the chosen fonts (scaled to match Jersey 10's size), then points the
 * --font (menus) and --font-typing (typed words) CSS variables at them. Called
 * once at startup and again on every change. Until a font is ready, the
 * previous one stays on screen.
 */
export async function applyFontSettings() {
  const count = ++applyCount
  // read() and setFontSettings() only keep names in FONTS
  const menu = findFont(current.menu)!
  const typing = findFont(current.typing)!
  await Promise.all([loadFont(menu), loadFont(typing)])
  if (count !== applyCount) return

  const root = document.documentElement.style
  root.setProperty('--font', fontFamilyValue(menu))
  root.setProperty('--font-typing', fontFamilyValue(typing))
}
