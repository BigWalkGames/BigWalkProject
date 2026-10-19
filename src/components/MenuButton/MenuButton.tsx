import { Link } from 'react-router';
import { KeyCap } from '../KeyCap/KeyCap';
import './MenuButton.css';

type MenuIcon = {
  normal: string;
  pressed: string;
};

type MenuButtonProps = {
  hotkey: string;
  children: React.ReactNode;
  icon?: MenuIcon;
  to?: string;         
  onClick?: () => void; 
};

export function MenuButton({ hotkey, children, icon, to, onClick }: MenuButtonProps) {
  const content = (
    <>
      <KeyCap label={hotkey} size="sm" />
      <span className="menu-btn__text">{children}</span>
      {icon && (
        <span className="menu-btn__icon">
          <img src={icon.normal} alt="" className="menu-btn__img menu-btn__img--normal" />
          <img src={icon.pressed} alt="" className="menu-btn__img menu-btn__img--pressed" />
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="menu-btn" aria-keyshortcuts={hotkey}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="menu-btn" onClick={onClick} aria-keyshortcuts={hotkey}>
      {content}
    </button>
  );
}