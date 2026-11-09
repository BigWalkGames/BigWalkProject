import { useState } from 'react';
import { useNavigate } from 'react-router';
import { NavButton } from '../NavButton/NavButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import { SwirlBackground } from '../../features/3d-flourish/SwirlBackground';
import { GameplayHeaderContext } from './useGameplayHeader';
import './ScreenLayout.css';

type ScreenLayoutProps = {
  title: string;
  headerLeft?: React.ReactNode;   // e.g. WPM / accuracy on Time Attack
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;       // extra bottom-row buttons, shown after Back
  backTo?: string;                // where Back and Esc go (default: home)
  showBack?: boolean;             // set false on screens like Time Attack
  /**
   * Pixel swirl behind the screen: 'faded' (animated, calm), 'faded-still'
   * (one still frame, for gameplay screens), or 'none'.
   */
  background?: 'faded' | 'faded-still' | 'none';
  backDisabled?: boolean;         // keep Back visible but turn off the button and Esc
  /**
   * 'gameplay' is the header for match screens: the HUD on the left, shortcut
   * legends and Back on the right (see useGameplayHeader), and no footer Back.
   */
  header?: 'standard' | 'gameplay';
  children: React.ReactNode;
};

export function ScreenLayout({
  title,
  headerLeft,
  headerRight,
  footer,
  backTo = '/',
  showBack = true,
  background = 'faded',
  backDisabled = false,
  header = 'standard',
  children,
}: ScreenLayoutProps) {
  const navigate = useNavigate();
  const [hud, setHud] = useState<HTMLElement | null>(null);
  const [shortcuts, setShortcuts] = useState<HTMLElement | null>(null);
  const gameplay = header === 'gameplay';

  useHotkeys(showBack ? { escape: () => navigate(backTo) } : {}, {
    enabled: !backDisabled,
  });

  const hasHeader = Boolean(title || headerLeft || headerRight || gameplay);
  const hasFooter = (showBack && !gameplay) || Boolean(footer);

  const backButton =
    showBack &&
    (backDisabled ? (
      <NavButton hotkey="esc" disabled>
        Back
      </NavButton>
    ) : (
      <NavButton to={backTo} hotkey="esc">
        Back
      </NavButton>
    ));

  return (
    <main className={gameplay ? 'screen screen--gameplay' : 'screen'}>
      {background !== 'none' && (
        <SwirlBackground variant="faded" animated={background === 'faded'} />
      )}
      {hasHeader && (
        <header className="screen__header">
          <div className="screen__header-left">
            {headerLeft}
            {gameplay && <div className="screen__header-slot" ref={setHud} />}
          </div>
          <h1 className="screen__title">{title}</h1>
          <div className="screen__header-right">
            {headerRight}
            {gameplay && (
              <>
                <div className="screen__header-slot" ref={setShortcuts} />
                {backButton}
              </>
            )}
          </div>
        </header>
      )}

      <div className="screen__body">
        <GameplayHeaderContext value={gameplay ? { hud, shortcuts } : null}>
          {children}
        </GameplayHeaderContext>
      </div>

      {hasFooter && (
        <footer className="screen__footer">
          {!gameplay && backButton}
          {footer}
        </footer>
      )}
    </main>
  );
}