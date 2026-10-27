import { getSupabase } from '../../../lib/supabase'
import { cleanKeystrokes, updateStats, type Keystroke, type PlayerData } from '../../word-engine'

const STORAGE_PREFIX = 'bigwalk.player.'

let pendingSave: Promise<void> = Promise.resolve()

function newPlayer(userId: string): PlayerData {
  return { userId, netWpm: 0, netAccuracy: 0, bigramStats: {}, keyStats: {} }
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? 'local'
}

// Loads the current player; create new if doesn't exist.
export async function readPlayer(): Promise<PlayerData> {
  const userId = await currentUserId()
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId)
    if (raw) return JSON.parse(raw) as PlayerData
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return newPlayer(userId)
}

export async function loadPlayer(): Promise<PlayerData> {
    await pendingSave
    return readPlayer()
}

export function recordMatch(log: Keystroke[], netWpm: number, netAccuracy: number): Promise<void> {
  pendingSave = pendingSave.then(async () => {
    try {
      const player = await readPlayer()
      const updated = updateStats(player, cleanKeystrokes(log))
      await savePlayer({ ...updated, netWpm, netAccuracy })
    } catch (error) {
      console.warn('[player] failed to record match', error)
    }
  })
  return pendingSave
}


export async function savePlayer(player: PlayerData): Promise<void> {
  try {
    localStorage.setItem(STORAGE_PREFIX + player.userId, JSON.stringify(player))
  } catch {
    // Storage full or unavailable: no data persistence.
  }
}