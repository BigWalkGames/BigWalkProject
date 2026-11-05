import { NavButton } from '../NavButton/NavButton';
import { StateMessage } from './StateMessage';
import { useHotkeys } from '../../hooks/useHotkeys';
import type { Notice } from '../../net/useQuickMatch';
import disconnectIcon from '../../assets/disconnect.png';
import './NoticeScreen.css';

/**
 * Full-screen message shown on the Main Menu when a match ends badly (P37):
 * connection lost, room closed, no opponent, opponent left. Esc or Enter closes it.
 */
export function NoticeScreen({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  useHotkeys({ escape: onClose, enter: onClose });

  return (
    <div className="notice-screen">
      <StateMessage
        title={notice.title}
        message={notice.message}
        icon={notice.disconnected ? disconnectIcon : undefined}
      />
      <div className="notice-screen__actions">
        <NavButton hotkey="esc" onClick={onClose}>
          Main Menu
        </NavButton>
      </div>
    </div>
  );
}
