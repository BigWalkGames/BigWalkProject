import { useSyncExternalStore } from 'react'
import bear from '../../assets/avatars/bear.png'
import bird from '../../assets/avatars/bird.png'
import pigeon from '../../assets/avatars/pigeon.png'
import frog from '../../assets/avatars/frog.png'
import wolf from '../../assets/avatars/wolf.png'

/** The pictures a player can choose. No picture (null) shows the default silhouette. */
export const PROFILE_PICTURES = [
  { id: 'bear', label: 'Bear', src: bear },
  { id: 'bird', label: 'Bird', src: bird },
  { id: 'pigeon', label: 'Pigeon', src: pigeon },
  { id: 'frog', label: 'Frog', src: frog },
  { id: 'wolf', label: 'Wolf', src: wolf },
] as const

export type ProfilePictureId = (typeof PROFILE_PICTURES)[number]['id']

const BY_ID = new Map<string, (typeof PROFILE_PICTURES)[number]>(
  PROFILE_PICTURES.map((picture) => [picture.id, picture]),
)

export function isProfilePictureId(value: unknown): value is ProfilePictureId {
  return typeof value === 'string' && BY_ID.has(value)
}

/** The picture for an id, or undefined for none or an unknown id (shows the default). */
export function profilePicture(id: string | null | undefined) {
  return id ? BY_ID.get(id) : undefined
}

/*
 * Each account's chosen picture, saved in this browser only, keyed by user id so
 * two accounts on one computer don't share a picture.
 *
 * TODO(supabase): M8 (Profile picture) moves this to the account: load the
 * Member's picture from the profiles table at log-in, and save it through the
 * profile picture route in setProfilePicture. Until then a new device or browser
 * starts with the default.
 */
const STORAGE_KEY = 'bigwalk.profilePictures'

function read(): Record<string, ProfilePictureId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const saved = JSON.parse(raw) as Record<string, unknown>
    const valid: Record<string, ProfilePictureId> = {}
    for (const [userId, id] of Object.entries(saved)) {
      if (isProfilePictureId(id)) valid[userId] = id
    }
    return valid
  } catch {
    // Storage unavailable or corrupt: everyone has the default.
    return {}
  }
}

let current = read()
const listeners = new Set<() => void>()

export function getProfilePicture(userId: string): ProfilePictureId | null {
  return current[userId] ?? null
}

/** Sets (or, with null, clears) an account's picture. Every screen showing it updates. */
export function setProfilePicture(userId: string, id: ProfilePictureId | null) {
  const next = { ...current }
  if (id) next[userId] = id
  else delete next[userId]
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

export function useProfilePicture(userId: string): ProfilePictureId | null {
  return useSyncExternalStore(subscribe, () => current[userId] ?? null)
}

/**
 * The opponent's name and picture in a match.
 *
 * TODO(server): the server's match_found only sends session ids. Once it also
 * sends each player's username (or "Guest") and picture id, return those here.
 * Until then every opponent is "Opponent" with the default picture.
 */
export function opponentProfile(): { name: string; picture: ProfilePictureId | null } {
  return { name: 'Opponent', picture: null }
}
