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
      <div className="menu-btn-group">
        <MenuButton
          hotkey="Q"
          to="/solo/time-attack"
          icon={{ normal: hourglass, pressed: hourglassPressed }}
        >
          Time Attack
        </MenuButton>
      </div>

      {/* TEMPORARY: will replace with the History panel from the Figma */}
      <div className="menu-btn-group" style={{ marginTop: 20 }}>
        <MenuButton hotkey="H" to="/history">
          History
        </MenuButton>
      </div>
    </ScreenLayout>
  );
}