import { Link } from 'react-router';
import { KeyCap } from '../KeyCap/KeyCap';
import './NavButton.css';

type NavIcon = {
  normal: string;
  pressed: string;
};

type NavButtonProps = {
  to: string;
  hotkey: string;
  children: React.ReactNode;
  icon?: NavIcon;
};

export function NavButton({ to, hotkey, children, icon }: NavButtonProps) {
  return (
    <Link to={to} className="nav-btn" aria-keyshortcuts={hotkey}>
      <KeyCap label={hotkey} size="sm" />
      <span>{children}</span>
      {icon && (
        <span className="nav-btn__icon">
          <img src={icon.normal} alt="" className="nav-btn__img nav-btn__img--normal" />
          <img src={icon.pressed} alt="" className="nav-btn__img nav-btn__img--pressed" />
        </span>
      )}
    </Link>
  );
}