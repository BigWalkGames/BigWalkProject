import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { NavButton } from '../../components/NavButton/NavButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import { createRoom, getState, setReady } from '../../net/quickMatch';
import { useQuickMatch } from '../../net/useQuickMatch';
import './CustomGame.css';

/**
 * P26, P28: the room lobby. Shows the room code, who is in the room, and each
 * player's ready state. The race starts by itself when both players are ready.
 *
 * `create` makes a new room when the screen opens (Create Room). Without it the
 * player is already in a room (they just joined with a code).
 */
export default function RoomLobby({ create = false }: { create?: boolean }) {
  const navigate = useNavigate();
  const { status, lobby, sessionId } = useQuickMatch();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (create) {
      void createRoom();
    } else if (getState().status === 'idle') {
      // Opened directly (a refresh, or typing the address): there is no room.
      navigate('/multiplayer/custom', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'countdown' || status === 'racing') {
      navigate('/multiplayer/versus', { replace: true });
    }
  }, [status, navigate]);

  const players = lobby?.players ?? [];
  const me = players.find((p) => p.id === sessionId);
  const friend = players.find((p) => p.id !== sessionId);
  const canReady = Boolean(friend);

  const toggleReady = () => {
    if (canReady) setReady(!me?.ready);
  };

  const copyCode = () => {
    if (!lobby) return;
    void navigator.clipboard?.writeText(lobby.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  useHotkeys({ r: toggleReady, c: copyCode });

  return (
    <ScreenLayout
      title="Custom Game"
      backTo="/multiplayer/custom"
      footer={
        <>
          <NavButton hotkey="R" onClick={toggleReady} disabled={!canReady}>
            {me?.ready ? 'Not Ready' : 'Ready'}
          </NavButton>
          <NavButton hotkey="C" onClick={copyCode} disabled={!lobby}>
            {copied ? 'Copied' : 'Copy Code'}
          </NavButton>
        </>
      }
    >
      <div className="lobby">
        <p className="lobby__label">Room code</p>
        <p className="lobby__code" aria-label="Room code" data-testid="room-code">
          {lobby?.code ?? '·····'}
        </p>
        <p className="lobby__hint">Give this code to your friend. Press Esc to leave the room.</p>

        <ul className="lobby__players">
          <PlayerCard name="You" ready={me?.ready ?? false} present={Boolean(me) || Boolean(lobby)} />
          <PlayerCard name="Friend" ready={friend?.ready ?? false} present={Boolean(friend)} />
        </ul>

        <p className="lobby__status" role="status">
          {!friend
            ? 'Waiting for your friend to join...'
            : me?.ready
              ? 'Waiting for your friend to press Ready...'
              : 'Press R when you are ready.'}
        </p>
      </div>
    </ScreenLayout>
  );
}

function PlayerCard({ name, ready, present }: { name: string; ready: boolean; present: boolean }) {
  return (
    <li className={`lobby__player${present ? '' : ' is-empty'}${ready ? ' is-ready' : ''}`}>
      <span className="lobby__player-name">{present ? name : 'Empty'}</span>
      <span className="lobby__player-state">{present ? (ready ? 'Ready' : 'Not ready') : '—'}</span>
    </li>
  );
}
