import { useEffect } from 'react'
import { artForSkin, keySkinVars, loadKeySkinArt } from './keySkinArt'
import { useMyKeySkin } from './useMyKeySkin'

/**
 * Puts the player's equipped skin on the page root, so every 2D keycap
 * (skinnedKey.css) uses it. Renders nothing; mount once inside the auth
 * provider.
 */
export function KeySkinApplier() {
  const skin = useMyKeySkin()

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
