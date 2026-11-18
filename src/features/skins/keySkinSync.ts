import { getSupabase } from '../../lib/supabase'
import { getKeySkin, isKeySkinId, setKeySkin, type KeySkinId } from './keySkins'

/**
 * Keeps a Member's equipped skin on their account, so it follows them to any
 * device. The store in keySkins.ts stays the source for rendering and works
 * as this device's cache. Guests and signed-out players only use the store.
 */

/** Saves run one at a time, so the account always ends on the last pick. */
let saving: Promise<void> = Promise.resolve()

/** Reads the Member's equipped skin from their account into the store. */
export async function loadKeySkin(userId: string): Promise<void> {
  const before = getKeySkin(userId)
  let skin: unknown
  try {
    const { data, error } = await getSupabase().rpc('get_my_keyboard_skin')
    if (error) throw error
    skin = data
  } catch (error) {
    console.warn('[skins] load failed; using this device’s skin', error)
    return
  }
  // A pick made while loading wins; its save is already on the way.
  if (getKeySkin(userId) !== before) return
  // An ID this client doesn't know (from a newer build) keeps the current skin.
  if (isKeySkinId(skin)) setKeySkin(userId, skin)
}

/**
 * Equips a skin right away, and saves it to the account for Members.
 * A failed save keeps the skin on this device until the next load.
 */
export function equipKeySkin(userId: string, id: KeySkinId, isMember: boolean): Promise<void> {
  setKeySkin(userId, id)
  if (!isMember) return Promise.resolve()

  saving = saving.then(async () => {
    try {
      const { error } = await getSupabase().rpc('equip_keyboard_skin', { p_skin: id })
      if (error) throw error
    } catch (error) {
      console.warn('[skins] save failed; kept on this device only', error)
    }
  })
  return saving
}
