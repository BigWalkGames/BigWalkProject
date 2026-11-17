import { Suspense, use, type CSSProperties } from 'react'
import { KeyCap } from '../../components/KeyCap/KeyCap'
import { useAuth } from '../../hooks/auth/useAuth'
import { menuMoveSound } from '../audio/menuSounds'
import { playSound } from '../audio/sound'
import { artForSkin, keySkinVars, loadKeySkinArt } from './keySkinArt'
import { DEFAULT_KEY_SKIN, KEY_SKINS, setKeySkin } from './keySkins'
import { useMyKeySkin } from './useMyKeySkin'
import './KeySkinPicker.css'

/**
 * "Keyboard skins" on the Account Customization tab. Picking one restyles
 * every keycap right away. Guests can only use the default skin.
 */
export function KeySkinPicker() {
  const { isGuest } = useAuth()

  return (
    <section className="skin-picker" aria-labelledby="skin-picker-title">
      <h2 id="skin-picker-title" className="skin-picker__title">Keyboard skins</h2>
      {isGuest && (
        <p className="skin-picker__note">Create an account to use keyboard skins.</p>
      )}
      <Suspense fallback={null}>
        <SkinOptions isGuest={isGuest} />
      </Suspense>
    </section>
  )
}

function SkinOptions({ isGuest }: { isGuest: boolean }) {
  const { user } = useAuth()
  const equipped = useMyKeySkin()
  const cells = use(loadKeySkinArt())

  return (
    <div className="skin-picker__options" role="group" aria-label="Keyboard skins">
      {KEY_SKINS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="skin-picker__option"
          aria-pressed={equipped === id}
          disabled={isGuest && id !== DEFAULT_KEY_SKIN}
          onClick={() => {
            playSound('menuSelect')
            setKeySkin(user?.id ?? 'local', id)
          }}
          {...menuMoveSound}
        >
          {/* Each preview wears its own skin, whatever is equipped. */}
          <span style={keySkinVars(artForSkin(cells, id)) as CSSProperties}>
            <KeyCap label="A" />
          </span>
          <span className="skin-picker__label">{label}</span>
        </button>
      ))}
    </div>
  )
}
