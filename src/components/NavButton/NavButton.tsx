import { Fragment } from 'react';
import { Link } from 'react-router';
import { KeyCap } from '../KeyCap/KeyCap';
import './NavButton.css';

type NavButtonProps = {
  hotkey: string | string[];
  children: React.ReactNode;
  icon?: { normal: string; pressed: string };
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Draw attention to this button (for example, when a friend is waiting for you to press it). */
  highlight?: boolean;
};

export function NavButton({ hotkey, children, icon, to, onClick, disabled, highlight }: NavButtonProps) {
  const keys = Array.isArray(hotkey) ? hotkey : [hotkey];

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
          <img src={icon.normal} alt="" className="nav-btn__img nav-btn__img--normal" />
          <img src={icon.pressed} alt="" className="nav-btn__img nav-btn__img--pressed" />
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`nav-btn${highlight ? ' nav-btn--highlight' : ''}`}
        aria-keyshortcuts={keys.join('+')}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`nav-btn${highlight ? ' nav-btn--highlight' : ''}`}
      aria-keyshortcuts={keys.join('+')}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </button>
  );
}