import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { MenuButton } from '../../components/MenuButton/MenuButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import hourglass from '../../assets/hourglass.png';
import hourglassPressed from '../../assets/hourglasspressed.png';

export default function Multiplayer() {
  const navigate = useNavigate();

  useHotkeys({
    q: () => navigate('/multiplayer/versus'),
    r: () => navigate('/history'),
    a: () => navigate('/leaderboards'),
  });

  return (
    <ScreenLayout title="Multiplayer">
      <div className="menu-btn-group">
        <MenuButton
          hotkey="Q"
          to="/multiplayer/versus"
          icon={{ normal: hourglass, pressed: hourglassPressed }}
        >
          Quick Match
        </MenuButton>
        <MenuButton hotkey="R" to="/history">
          Match History
        </MenuButton>
      </div>

      {/* TEMPORARY: will replace with the Leaderboards panel from the Figma */}
      <div className="menu-btn-group" style={{ marginTop: 20 }}>
        <MenuButton hotkey="A" to="/leaderboards">
          Leaderboards
        </MenuButton>
      </div>
    </ScreenLayout>
  );
}