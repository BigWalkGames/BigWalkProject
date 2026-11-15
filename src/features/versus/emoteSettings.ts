import { useSyncExternalStore } from 'react'
import { DEFAULT_EMOTE_SLOTS, isEmoteId, type EmoteId, type EmoteSlot } from './emotes'

/** Which emote each arrow key sends. Saved on this device. */
export type EmoteSlots = Record<EmoteSlot, EmoteId>

const STORAGE_KEY = 'bigwalk.emoteSlots'

function read(): EmoteSlots {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<EmoteSlot, unknown>>
      const slots = { ...DEFAULT_EMOTE_SLOTS }
      // Only keep ids that still exist, so an old or edited value can't send junk.
      for (const slot of Object.keys(slots) as EmoteSlot[]) {
        if (isEmoteId(saved[slot])) slots[slot] = saved[slot]
      }
      return slots
    }
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return DEFAULT_EMOTE_SLOTS
}

let current = read()
const listeners = new Set<() => void>()

function save(next: EmoteSlots) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage full or unavailable: the choice lasts until reload.
  }
  for (const listener of listeners) listener()
}

/** Put a different emote on one arrow key. */
export function setEmoteSlot(slot: EmoteSlot, id: EmoteId) {
  save({ ...current, [slot]: id })
}

export function resetEmoteSlots() {
  save(DEFAULT_EMOTE_SLOTS)
}

/** The current choice, read by the key handler at the moment a key is pressed. */
export function getEmoteSlots(): EmoteSlots {
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useEmoteSlots(): EmoteSlots {
  return useSyncExternalStore(subscribe, () => current)
}
