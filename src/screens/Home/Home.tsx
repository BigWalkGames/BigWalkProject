import { lazy, Suspense, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { KeyCap } from '../../components/KeyCap/KeyCap';
import { NavButton } from '../../components/NavButton/NavButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useKeyChord } from '../../hooks/useKeyChord';
import { useKeysDown } from '../../hooks/useKeysDown';
import soloIcon from '../../assets/soloicon.png';
import soloIconPressed from '../../assets/soloiconpressed.png';
import multiplayerIcon from '../../assets/multiplayericon.png';
import multiplayerIconPressed from '../../assets/multiplayericonpressed.png';
import accountIcon from '../../assets/accounticon.png';
import accountIconPressed from '../../assets/accounticonpressed.png';
import gearIcon from '../../assets/gearicon.png';
import gearIconPressed from '../../assets/geariconpressed.png';
import { useAuth } from '../../hooks/auth/useAuth';
import { Hero3DBoundary } from '../../features/3d-flourish/Hero3DBoundary';
import { SwirlBackground } from '../../features/3d-flourish/SwirlBackground';
import './Home.css';

// The 3D hero (with three.js) is its own chunk. Start downloading it as soon
// as the app loads (this module is imported at startup), so it's usually ready
// by the time Home shows, even during the login check or login screen.
const heroChunk = import('../../features/3d-flourish/HomeHero3D');
const HomeHero3D = lazy(() => heroChunk);

/** Lets the F + J press animation show before switching screens. */
const CHORD_DELAY_MS = 150;

export default function Home() {
  const navigate = useNavigate();
  // A message from a screen that sent the player back here (for example, no opponent found).
  const notice = (useLocation().state as { notice?: string } | null)?.notice;

  const { user, isGuest } = useAuth();

  const playerName = isGuest
    ? 'Guest'
    : (user?.user_metadata?.username as string | undefined);

  useHotkeys({
    s: () => navigate('/solo'),
    w: () => navigate('/multiplayer'),
    e: () => navigate('/account'),
    r: () => navigate('/settings'),
  });

  const chordTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(chordTimer.current), []);
  useKeyChord(['f', 'j'], () => {
    window.clearTimeout(chordTimer.current);
    chordTimer.current = window.setTimeout(() => navigate('/solo/time-attack'), CHORD_DELAY_MS);
  });
  const keysDown = useKeysDown(['f', 'j']);

  // The 2D hero: only if the 3D one fails (no WebGL, or the chunk failed).
  const flatHero = (asHeading: boolean) => (
    <>
      {asHeading ? (
        <h1 className="home__title">B!GWALK</h1>
      ) : (
        <div className="home__title" aria-hidden="true">B!GWALK</div>
      )}
      <div className="home__keys">
        <KeyCap label="F" pressed={keysDown.has('f')} />
        <span className="home__plus">+</span>
        <KeyCap label="J" pressed={keysDown.has('j')} />
      </div>
    </>
  );

  return (
    <main className="home">
      <SwirlBackground />
      {playerName && (
        <p className="home__player" aria-label={`Signed in as ${playerName}`}>
          {playerName}
        </p>
      )}
      {notice && (
        <p
          role="status"
          style={{
            position: 'absolute',
            top: 16,
            left: 0,
            right: 0,
            textAlign: 'center',
          }}>
          {notice}
        </p>
      )}
      <section className="home__hero">
        <Hero3DBoundary fallback={flatHero(true)}>
          <h1 className="home__sr-only">B!GWALK</h1>
          {/* While loading, hold the canvas's space empty: the 3D intro pops the
              letters in from nothing, so there's no flash of the 2D hero. */}
          <Suspense fallback={<div className="home__hero-placeholder" aria-hidden="true" />}>
            <HomeHero3D keysDown={keysDown} fallback={flatHero(false)} />
          </Suspense>
        </Hero3DBoundary>
      </section>

      <nav className="home__nav" aria-label="Main">
        <NavButton
          to="/solo"
          hotkey="S"
          icon={{ normal: soloIcon, pressed: soloIconPressed }}>
          Solo
        </NavButton>
        <NavButton
          to="/multiplayer"
          hotkey="W"
          icon={{ normal: multiplayerIcon, pressed: multiplayerIconPressed }}>
          Multiplayer
        </NavButton>
        <NavButton
          to="/account"
          hotkey="E"
          icon={{ normal: accountIcon, pressed: accountIconPressed }}>
          Account
        </NavButton>
        <NavButton
          to="/settings"
          hotkey="R"
          icon={{ normal: gearIcon, pressed: gearIconPressed }}>
          Settings
        </NavButton>
      </nav>
    </main>
  );
}
