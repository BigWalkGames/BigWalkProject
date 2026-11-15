import { useState, type FocusEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { KeyCap } from '../KeyCap/KeyCap';
import { playSound } from '../../features/audio/sound';
import { menuMoveSound } from '../../features/audio/menuSounds';
import './MenuButton.css';

type MenuIcon = {
  normal: string;
  pressed: string;
};

/** What an animated icon needs to know about its button. */
export type MenuIconState = {
  /** Mouse over the button, or keyboard focus on it. */
  hovered: boolean;
  /** Mouse/touch held down on the button (its :active look). */
  pressed: boolean;
};

type MenuButtonProps = {
  hotkey: string;
  children: React.ReactNode;
  icon?: MenuIcon;
  /**
   * Optional animated icon (e.g. the 3D hourglass) shown instead of the
   * `icon` images. It gets the button's hover/press state, plus the `icon`
   * images as `fallback` for while it loads or if it can't run.
   */
  iconScene?: (state: MenuIconState, fallback: ReactNode) => ReactNode;
  to?: string;
  onClick?: () => void;
};

export function MenuButton({ hotkey, children, icon, iconScene, to, onClick }: MenuButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const images = icon && (
    <>
      <img src={icon.normal} alt="" className="menu-btn__img menu-btn__img--normal" />
      <img src={icon.pressed} alt="" className="menu-btn__img menu-btn__img--pressed" />
    </>
  );

  const content = (
    <>
      <KeyCap label={hotkey} size="sm" />
      <span className="menu-btn__text">{children}</span>
      {iconScene ? (
        <span className="menu-btn__icon">{iconScene({ hovered, pressed }, images)}</span>
      ) : (
        icon && <span className="menu-btn__icon">{images}</span>
      )}
    </>
  );

  // Hover/press tracking only matters for an animated icon.
  const track = iconScene
    ? {
        onPointerLeave: () => {
          setHovered(false);
          setPressed(false);
        },
        onBlur: () => setHovered(false),
        onPointerDown: () => setPressed(true),
        onPointerUp: () => setPressed(false),
        onPointerCancel: () => setPressed(false),
      }
    : {};

  // Menu clicks: move on hover / keyboard focus, select on click.
  const onPointerEnter = () => {
    menuMoveSound.onPointerEnter();
    if (iconScene) setHovered(true);
  };
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    menuMoveSound.onFocus(event);
    if (iconScene) setHovered(true);
  };
  const click = () => {
    playSound('menuSelect');
    onClick?.();
  };
  const handlers = { ...track, onPointerEnter, onFocus, onClick: click };

  if (to) {
    return (
      <Link to={to} className="menu-btn" aria-keyshortcuts={hotkey} {...handlers}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="menu-btn" aria-keyshortcuts={hotkey} {...handlers}>
      {content}
    </button>
  );
}
