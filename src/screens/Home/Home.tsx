import { useNavigate } from 'react-router';
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
import './Home.css';

export default function Home() {
  const navigate = useNavigate();

  useHotkeys({
    s: () => navigate('/solo'),
    w: () => navigate('/multiplayer'),
    e: () => navigate('/account'),
    r: () => navigate('/settings'),
  });

  useKeyChord(['f', 'j'], () => navigate('/solo'));
  const keysDown = useKeysDown(['f', 'j']);

  return (
    <main className="home">
      <section className="home__hero">
        <h1 className="home__title">B!GWALK</h1>
            <div className="home__keys">
                <KeyCap label="F" pressed={keysDown.has('f')} />
                <span className="home__plus">+</span>
                <KeyCap label="J" pressed={keysDown.has('j')} />
            </div>
      </section>

      <nav className="home__nav" aria-label="Main">
        <NavButton to="/solo" hotkey="S" icon={{ normal: soloIcon, pressed: soloIconPressed }}>
          Solo
        </NavButton>
        <NavButton
          to="/multiplayer"
          hotkey="W"
          icon={{ normal: multiplayerIcon, pressed: multiplayerIconPressed }}
        >
          Multiplayer
        </NavButton>
        <NavButton to="/account" hotkey="E" icon={{ normal: accountIcon, pressed: accountIconPressed }}>
          Account
        </NavButton>
        <NavButton to="/settings" hotkey="R" icon={{ normal: gearIcon, pressed: gearIconPressed }}>
          Settings
        </NavButton>
      </nav>
    </main>
  );
}