import './Solo.css';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { MenuButton } from '../../components/MenuButton/MenuButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import hourglass from '../../assets/hourglass.png';
import hourglassPressed from '../../assets/hourglasspressed.png';
import { HourglassIcon } from '../../features/3d-flourish/HourglassIcon';
import { HistoryPreview } from '../../components/HistoryPreview/HistoryPreview';
import {
  TIME_ATTACK_LENGTHS,
  setTimeAttackLength,
  useTimeAttackLength,
} from '../../features/typing/timeAttackLength';
import { TimeAttackLengthPicker } from './TimeAttackLengthPicker';

export default function Solo() {
  const navigate = useNavigate();
  const length = useTimeAttackLength();

  // 1 / 2 / 3 pick the Time Attack length (P48) without opening the dropdown.
  // Picking the current one plays no sound.
  const pickByKey = (index: number) => () => {
    const next = TIME_ATTACK_LENGTHS[index];
    if (next === length) return false;
    setTimeAttackLength(next);
  };

  useHotkeys({
    q: () => navigate('/solo/time-attack'),
    h: () => navigate('/history'),
    '1': pickByKey(0),
    '2': pickByKey(1),
    '3': pickByKey(2),
  });

  return (
    <ScreenLayout title="Solo">
      <div className="solo">
        <div className="solo__menu">
          <div className="menu-btn-group">
            {/* Time Attack, with its length dropdown (P48, D opens it) beside it. */}
            <div className="solo__time-attack">
              <MenuButton
                hotkey="Q"
                to="/solo/time-attack"
                icon={{ normal: hourglass, pressed: hourglassPressed }}
                iconScene={(state, fallback) => <HourglassIcon {...state} fallback={fallback} />}
              >
                Time Attack
              </MenuButton>
              <TimeAttackLengthPicker />
            </div>
          </div>
        </div>

        <aside className="solo__panel">
          <HistoryPreview />
        </aside>
      </div>
    </ScreenLayout>
  );
}
