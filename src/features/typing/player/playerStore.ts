import { getSupabase } from '../../../lib/supabase'
import { cleanKeystrokes, updateStats, type Keystroke, type PlayerData } from '../../word-engine'

const STORAGE_PREFIX = 'bigwalk.player.'
const LOCAL_USER = 'local'

let pendingSave: Promise<void> = Promise.resolve()

function newPlayer(userId: string): PlayerData {
  return { userId, netWpm: 0, netAccuracy: 0, bigramStats: {}, keyStats: {} }
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? LOCAL_USER
}

function readLocal(userId: string): PlayerData | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId)
    return raw ? (JSON.parse(raw) as PlayerData) : null
  } catch {
    // Storage unavailable or corrupt: nothing to use.
    return null
  }
}

function writeLocal(player: PlayerData): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + player.userId, JSON.stringify(player))
  } catch {
    // Storage full or unavailable: no data persistence.
  }
}

function clearLocal(userId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + userId)
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

function sampleCount(player: PlayerData): number {
  return Object.values(player.bigramStats).reduce((sum, s) => sum + s.latencySamples + s.errorSamples, 0)
}

async function fetchRemote(userId: string): Promise<PlayerData> {
  const { data, error } = await getSupabase().rpc('get_player_stats', { acc_id: userId })
  if (error) throw error
  const row = data?.[0]
  if (!row) return newPlayer(userId)
  return {
    userId,
    netWpm: Number(row.net_wpm),
    netAccuracy: Number(row.net_accuracy),
    bigramStats: row.bigram_stats,
    keyStats: row.key_stats,
  }
}

// Throws if Supabase can't be read, so callers never save over stats they didn't load.
async function fetchPlayer(userId: string): Promise<PlayerData> {
  const local = readLocal(userId)
  if (userId === LOCAL_USER) return local ?? newPlayer(userId)

  const remote = await fetchRemote(userId)
  if (!local) return remote

  // A local copy is a failed save or stats from before Supabase storage. Keep whichever has seen more typing.
  if (sampleCount(local) <= sampleCount(remote)) {
    clearLocal(userId)
    return remote
  }
  const player = { ...local, netWpm: remote.netWpm, netAccuracy: remote.netAccuracy }
  await savePlayer(player)
  return player
}

// Loads the current player; create new if doesn't exist.
export async function readPlayer(): Promise<PlayerData> {
  return fetchPlayer(await currentUserId())
}

export async function loadPlayer(): Promise<PlayerData> {
    await pendingSave
    return readPlayer()
}

// netWpm and netAccuracy only apply to signed-out players. Signed-in players get
// their all-time averages from users.histories.
export function recordMatch(log: Keystroke[], netWpm: number, netAccuracy: number): Promise<void> {
  pendingSave = pendingSave.then(async () => {
    try {
      const userId = await currentUserId()
      const samples = cleanKeystrokes(log)
      let player: PlayerData
      try {
        player = await fetchPlayer(userId)
      } catch (error) {
        console.warn('[player] failed to load stats; keeping this match locally', error)
        const updated = updateStats(readLocal(userId) ?? newPlayer(userId), samples)
        writeLocal({ ...updated, netWpm, netAccuracy })
        return
      }
      const updated = updateStats(player, samples)
      await savePlayer(userId === LOCAL_USER ? { ...updated, netWpm, netAccuracy } : updated)
    } catch (error) {
      console.warn('[player] failed to record match', error)
    }
  })
  return pendingSave
}


export async function savePlayer(player: PlayerData): Promise<void> {
  if (player.userId === LOCAL_USER) {
    writeLocal(player)
    return
  }
  const { error } = await getSupabase().rpc('update_player_stats', {
    acc_id: player.userId,
    bigrams: player.bigramStats,
    keys: player.keyStats,
  })
  if (error) {
    console.warn('[player] failed to save stats; keeping them locally', error)
    writeLocal(player)
    return
  }
  clearLocal(player.userId)
}
