import { useSyncExternalStore } from 'react'

/**
 * The keyboard skins, in the order of their cells in
 * src/assets/skins/key-textures.png (left to right, then top to bottom).
 * The sheet's order is part of the format: add new skins at the end only, so
 * an equipped skin never points at a different cell. How to add one:
 * src/assets/skins/README.md.
 *
 * TODO(art): mint, wood and speckle are placeholder textures until the
 * designer's sheet replaces key-textures.png.
 */
export const KEY_SKINS = [
  { id: 'classic', label: 'Classic' },
  { id: 'mint', label: 'Mint' },
  { id: 'wood', label: 'Wood' },
  { id: 'speckle', label: 'Speckle' },
] as const

export type KeySkinId = (typeof KEY_SKINS)[number]['id']

export const DEFAULT_KEY_SKIN: KeySkinId = 'classic'

export function isKeySkinId(value: unknown): value is KeySkinId {
  return KEY_SKINS.some((skin) => skin.id === value)
}

/** The skin's cell in the texture sheet. */
export function keySkinIndex(id: KeySkinId): number {
  return KEY_SKINS.findIndex((skin) => skin.id === id)
}

/*
 * Each account's equipped skin, saved in this browser only, keyed by user id
 * so two accounts on one computer don't share a skin.
 *
 * TODO(supabase): M7 moves this to the account: load the Member's equipped
 * skin at log-in, and save it through the equip-skin route in setKeySkin.
 * Until then a new device or browser starts with the default.
 */
const STORAGE_KEY = 'bigwalk.keySkins'

function read(): Record<string, KeySkinId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const saved = JSON.parse(raw) as Record<string, unknown>
    const valid: Record<string, KeySkinId> = {}
    for (const [userId, id] of Object.entries(saved)) {
      if (isKeySkinId(id)) valid[userId] = id
    }
    return valid
  } catch {
    // Storage unavailable or corrupt: everyone has the default.
    return {}
  }
}

let current = read()
const listeners = new Set<() => void>()

export function getKeySkin(userId: string): KeySkinId {
  return current[userId] ?? DEFAULT_KEY_SKIN
}

/** Equips a skin for an account. Every keycap updates right away. */
export function setKeySkin(userId: string, id: KeySkinId) {
  const next = { ...current }
  if (id === DEFAULT_KEY_SKIN) delete next[userId]
  else next[userId] = id
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage full or unavailable: the choice lasts until reload.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useKeySkin(userId: string): KeySkinId {
  return useSyncExternalStore(subscribe, () => getKeySkin(userId))
}
