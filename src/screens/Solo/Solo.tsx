import './Solo.css';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { MenuButton } from '../../components/MenuButton/MenuButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import hourglass from '../../assets/hourglass.png';
import hourglassPressed from '../../assets/hourglasspressed.png';

export default function Solo() {
  const navigate = useNavigate();

  useHotkeys({
    q: () => navigate('/solo/time-attack'),
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