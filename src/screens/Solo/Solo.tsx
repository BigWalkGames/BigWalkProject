import './Solo.css';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { MenuButton } from '../../components/MenuButton/MenuButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import { GAME_MODES } from '../../features/typing/gameModes';
import hourglass from '../../assets/hourglass.png';
import hourglassPressed from '../../assets/hourglasspressed.png';

export default function Solo() {
  const navigate = useNavigate();

  useHotkeys({
    q: () => navigate('/solo/time-attack'),
    s: () => navigate(GAME_MODES.classic.route),
    h: () => navigate('/history'),
  });

  return (
    <ScreenLayout title="Solo">
      <div className="solo">
        <div className="solo__menu">
          <div className="menu-btn-group">
            <MenuButton
              hotkey="Q"
              to="/solo/time-attack"
              icon={{ normal: hourglass, pressed: hourglassPressed }}
            >
              Time Attack
            </MenuButton>
          </div>

          <div className="menu-btn-group">
            <MenuButton
              hotkey="S"
              to={GAME_MODES.classic.route}
              icon={{ normal: hourglass, pressed: hourglassPressed }}
            >
              {GAME_MODES.classic.label}
            </MenuButton>
          </div>

          {/* TEMPORARY: remove when the History panel exists */}
          <div className="menu-btn-group">
            <MenuButton hotkey="H" to="/history">
              History
            </MenuButton>
          </div>
        </div>

        <aside className="solo__panel">
          {/* History panel goes here later */}
        </aside>
      </div>
    </ScreenLayout>
  );
}