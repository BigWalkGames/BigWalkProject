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
import './Home.css';

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

  useKeyChord(['f', 'j'], () => navigate('/solo/time-attack'));
  const keysDown = useKeysDown(['f', 'j']);

  return (
    <main className="home">
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
        <h1 className="home__title">B!GWALK</h1>
        <div className="home__keys">
          <KeyCap label="F" pressed={keysDown.has('f')} />
          <span className="home__plus">+</span>
          <KeyCap label="J" pressed={keysDown.has('j')} />
        </div>
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
