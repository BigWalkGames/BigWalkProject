import { useAuth } from '../../hooks/auth/useAuth'
import { DEFAULT_KEY_SKIN, useKeySkin, type KeySkinId } from './keySkins'

/** The signed-in player's equipped skin. Guests always have the default. */
export function useMyKeySkin(): KeySkinId {
  const { user, isGuest } = useAuth()
  const saved = useKeySkin(user?.id ?? 'local')
  return isGuest ? DEFAULT_KEY_SKIN : saved
}
