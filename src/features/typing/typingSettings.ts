import { useSyncExternalStore } from 'react'

/** How the cursor moves between letters: 'off' jumps, the others slide. */
export type CaretSpeed = 'off' | 'fast' | 'medium' | 'slow'

export interface TypingSettings {
  caretSpeed: CaretSpeed
  /** Slide the words up when moving to the next line, instead of jumping. */
  smoothLines: boolean
}

/** Slide length per caret speed. Long enough to glide, short enough to keep up at 150+ WPM. */
export const CARET_SLIDE_MS: Record<CaretSpeed, number> = {
  off: 0,
  fast: 70,
  medium: 100,
  slow: 150,
}

/** How long the words take to slide up one line. */
export const LINE_SLIDE_MS = 125

const STORAGE_KEY = 'bigwalk.typingSettings'
const DEFAULTS: TypingSettings = { caretSpeed: 'medium', smoothLines: true }

function read(): TypingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<TypingSettings>) }
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return DEFAULTS
}

let current = read()
const listeners = new Set<() => void>()

export function setTypingSettings(patch: Partial<TypingSettings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage full or unavailable: the setting lasts until reload.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTypingSettings(): TypingSettings {
  return useSyncExternalStore(subscribe, () => current)
}
