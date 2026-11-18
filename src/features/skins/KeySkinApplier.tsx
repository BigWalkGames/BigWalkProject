import { useEffect } from 'react'
import { useAuth } from '../../hooks/auth/useAuth'
import { artForSkin, keySkinVars, loadKeySkinArt } from './keySkinArt'
import { loadKeySkin } from './keySkinSync'
import { useMyKeySkin } from './useMyKeySkin'

/**
 * Puts the player's equipped skin on the page root, so every 2D keycap
 * (skinnedKey.css) uses it, and loads a Member's skin from their account at
 * sign-in. Renders nothing; mount once inside the auth provider.
 */
export function KeySkinApplier() {
  const { user, isMember } = useAuth()
  const skin = useMyKeySkin()
  const memberId = isMember ? user?.id : undefined

  useEffect(() => {
    if (memberId) void loadKeySkin(memberId)
  }, [memberId])

  useEffect(() => {
    let cancelled = false
    loadKeySkinArt().then(
      (cells) => {
        if (cancelled) return
        const root = document.documentElement.style
        for (const [name, value] of Object.entries(keySkinVars(artForSkin(cells, skin)))) {
          root.setProperty(name, value)
        }
      },
      (error: unknown) => {
        // Keycaps keep the Classic look.
        console.error('Could not load the keyboard skins', error)
      },
    )
    return () => {
      cancelled = true
    }
  }, [skin])

  // Signed out: back to the Classic look on the login screen.
  useEffect(
    () => () => {
      const root = document.documentElement.style
      root.removeProperty('--skin-texture')
      root.removeProperty('--skin-label')
    },
    [],
  )

  return null
}
