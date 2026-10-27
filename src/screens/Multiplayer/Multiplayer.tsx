import './Multiplayer.css';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { MenuButton } from '../../components/MenuButton/MenuButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import hourglass from '../../assets/hourglass.png';
import hourglassPressed from '../../assets/hourglasspressed.png';

export default function Multiplayer() {
  const navigate = useNavigate();

  useHotkeys({
    q: () => navigate('/multiplayer/matchmaking'),
    c: () => navigate('/multiplayer/custom'),
    r: () => navigate('/matchhistory'),
    a: () => navigate('/leaderboards'),
  });

  return (
    <ScreenLayout title="Multiplayer">
      <div className="multiplayer">
        <div className="multiplayer__menu">
          <div className="menu-btn-group">
            <MenuButton
              hotkey="Q"
              to="/multiplayer/matchmaking"
              icon={{ normal: hourglass, pressed: hourglassPressed }}
            >
              Quick Match
            </MenuButton>
            <MenuButton hotkey="C" to="/multiplayer/custom">
              Custom Game
            </MenuButton>
            <MenuButton hotkey="R" to="/matchhistory">
              Match History
            </MenuButton>
          </div>

          {/* TEMPORARY: remove when the Leaderboards panel exists */}
          <div className="menu-btn-group">
            <MenuButton hotkey="A" to="/leaderboards">
              Leaderboards
            </MenuButton>
          </div>
        </div>

        <aside className="multiplayer__panel">
          {/* Leaderboards panel goes here later */}
        </aside>
      </div>
    </ScreenLayout>
  );
}