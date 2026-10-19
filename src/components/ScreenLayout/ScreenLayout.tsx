import { useNavigate } from 'react-router';
import { NavButton } from '../NavButton/NavButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import './ScreenLayout.css';

type ScreenLayoutProps = {
  title: string;
  headerLeft?: React.ReactNode;   // e.g. WPM / accuracy on Time Attack
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;       // extra bottom-row buttons, shown after Back
  backTo?: string;                // where Back and Esc go (default: home)
  showBack?: boolean;             // set false on screens like Time Attack
  children: React.ReactNode;
};

export function ScreenLayout({
  title,
  headerLeft,
  headerRight,
  footer,
  backTo = '/',
  showBack = true,
  children,
}: ScreenLayoutProps) {
  const navigate = useNavigate();

  useHotkeys(showBack ? { escape: () => navigate(backTo) } : {});

  const hasHeader = Boolean(title || headerLeft || headerRight);
  const hasFooter = showBack || Boolean(footer);

  return (
    <main className="screen">
      {hasHeader && (
        <header className="screen__header">
          <div className="screen__header-left">{headerLeft}</div>
          <h1 className="screen__title">{title}</h1>
          <div className="screen__header-right">{headerRight}</div>
        </header>
      )}

      <div className="screen__body">{children}</div>

      {hasFooter && (
        <footer className="screen__footer">
          {showBack && (
            <NavButton to={backTo} hotkey="esc">
              Back
            </NavButton>
          )}
          {footer}
        </footer>
      )}
    </main>
  );
}