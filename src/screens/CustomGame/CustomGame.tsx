import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { MenuButton } from '../../components/MenuButton/MenuButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import '../Multiplayer/Multiplayer.css';

/** P26, P27: Custom Game menu. Make a private room, or join a friend's with its code. */
export default function CustomGame() {
  const navigate = useNavigate();

  useHotkeys({
    c: () => navigate('/multiplayer/custom/create'),
    j: () => navigate('/multiplayer/custom/join'),
  });

  return (
    <ScreenLayout title="Custom Game" backTo="/multiplayer">
      <div className="multiplayer">
        <div className="multiplayer__menu">
          <div className="menu-btn-group">
            <MenuButton hotkey="C" to="/multiplayer/custom/create">
              Create Room
            </MenuButton>
            <MenuButton hotkey="J" to="/multiplayer/custom/join">
              Join Room
            </MenuButton>
          </div>
        </div>
        <aside className="multiplayer__panel" />
      </div>
    </ScreenLayout>
  );
}
