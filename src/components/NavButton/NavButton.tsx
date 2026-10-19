import { Link } from 'react-router';
import { KeyCap } from '../KeyCap/KeyCap';
import './NavButton.css';

type NavIcon = {
  normal: string;
  pressed: string;
};

type NavButtonProps = {
  hotkey: string;
  children: React.ReactNode;
  icon?: NavIcon;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function NavButton({ hotkey, children, icon, to, onClick, disabled }: NavButtonProps) {
  const content = (
    <>
      <KeyCap label={hotkey} size="sm" />
      <span>{children}</span>
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
      <Link to={to} className="nav-btn" aria-keyshortcuts={hotkey}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="nav-btn"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={hotkey}
    >
      {content}
    </button>
  );
}