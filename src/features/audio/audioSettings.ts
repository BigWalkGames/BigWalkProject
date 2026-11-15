import { useSyncExternalStore } from 'react'

/** Volume levels, each 0 to 100. Effective SFX volume is master x sfx. */
export interface AudioSettings {
  master: number
  sfx: number
  /** Saved now; no music plays yet. Whatever music is added later plays at this level. */
  music: number
}

export const AUDIO_CHANNELS = ['master', 'sfx', 'music'] as const
export type AudioChannel = (typeof AUDIO_CHANNELS)[number]

const STORAGE_KEY = 'bigwalk.audioSettings'
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { master: 50, sfx: 100, music: 100 }

/** A whole number from 0 to 100, or `fallback` if `value` isn't a number. */
function level(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.round(Math.min(100, Math.max(0, value)))
}

function read(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<AudioChannel, unknown>>
      return {
        master: level(saved.master, DEFAULT_AUDIO_SETTINGS.master),
        sfx: level(saved.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
        music: level(saved.music, DEFAULT_AUDIO_SETTINGS.music),
      }
    }
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return DEFAULT_AUDIO_SETTINGS
}

let current = read()
const listeners = new Set<() => void>()

export function getAudioSettings(): AudioSettings {
  return current
}

export function setAudioSettings(patch: Partial<AudioSettings>) {
  current = {
    master: level(patch.master ?? current.master, current.master),
    sfx: level(patch.sfx ?? current.sfx, current.sfx),
    music: level(patch.music ?? current.music, current.music),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage full or unavailable: the setting lasts until reload.
  }
  for (const listener of listeners) listener()
}

export function subscribeAudioSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(subscribeAudioSettings, () => current)
}

/**
 * Slider level (0-100) to gain (0-1). Squared, because hearing is roughly
 * logarithmic: with a straight line, 50 to 100 sounds like almost no change.
 */
export function levelToGain(value: number): number {
  const x = Math.min(100, Math.max(0, value)) / 100
  return x * x
}
