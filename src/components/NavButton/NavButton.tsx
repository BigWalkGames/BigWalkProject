import { Fragment } from 'react'
import { Link } from 'react-router'
import { KeyCap } from '../KeyCap/KeyCap'
import { playSound } from '../../features/audio/sound'
import { isBackHotkey, menuMoveSound } from '../../features/audio/menuSounds'
import './NavButton.css'

type NavButtonProps = {

  hotkey: string | string[]
  children: React.ReactNode
  icon?: { normal: string; pressed: string }
  to?: string
  onClick?: () => void
  disabled?: boolean
  /** Draw attention to this button (for example, when a friend is waiting for you to press it). */
  highlight?: boolean;
  type?: 'button' | 'submit' // lets Enter submit the form its in
};

export function NavButton({
  hotkey,
  children,
  icon,
  to,
  onClick,
  disabled,
  highlight,
  type = 'button'
}: NavButtonProps) {
  const keys = Array.isArray(hotkey) ? hotkey : [hotkey]

  // Menu clicks: move on hover / keyboard focus, select (or back, for Esc) on
  // click. Disabled buttons stay silent.
  const sounds = disabled ? {} : menuMoveSound
  const click = () => {
    if (disabled) return
    playSound(isBackHotkey(hotkey) ? 'menuBack' : 'menuSelect')
    onClick?.()
  }

  const content = (
    <>
      <span className="nav-btn__keys">
        {keys.map((k, i) => (
          <Fragment key={k}>
            {i > 0 && <span className="nav-btn__plus">+</span>}
            <KeyCap label={k} size="sm" />
          </Fragment>
        ))}
      </span>

      <span className="nav-btn__text">{children}</span>

      {icon && (
        <span className="nav-btn__icon">
          <img
            src={icon.normal}
            alt=""
            className="nav-btn__img nav-btn__img--normal"
          />
          <img
            src={icon.pressed}
            alt=""
            className="nav-btn__img nav-btn__img--pressed"
          />
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={`nav-btn${highlight ? ' nav-btn--highlight' : ''}`}
        aria-keyshortcuts={keys.join('+')}
        onClick={click}
        {...sounds}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type={type}
      className={`nav-btn${highlight ? ' nav-btn--highlight' : ''}`}
      aria-keyshortcuts={keys.join('+')}
      onClick={click}
      disabled={disabled}
      {...sounds}>
      {content}
    </button>
  )
}
