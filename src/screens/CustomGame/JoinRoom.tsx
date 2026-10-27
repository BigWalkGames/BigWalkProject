import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { joinRoom, type JoinError } from '../../net/quickMatch';
import './CustomGame.css';

const MESSAGES: Record<JoinError, string> = {
  invalid: "That code isn't right. Check it and try again.",
  full: 'That room is full.',
  expired: 'That room has closed. Ask your friend for a new code.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  connect_failed: 'Could not connect to the server.',
};

/** P27: type a friend's room code. A bad code shows its error here and keeps you on this screen. */
export default function JoinRoom() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<JoinError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (code.length !== 5) {
      setError('invalid');
      return;
    }
    setBusy(true);
    const problem = await joinRoom(code);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    navigate('/multiplayer/custom/lobby', { replace: true });
  }

  return (
    <ScreenLayout title="Join Room" backTo="/multiplayer/custom">
      <form
        className="join"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="join__label" htmlFor="room-code-input">
          Enter the room code
        </label>
        <input
          id="room-code-input"
          className="join__input"
          value={code}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={5}
          placeholder="·····"
          aria-invalid={error !== null}
          aria-describedby="room-code-error"
          onChange={(e) => {
            // Letters and numbers only. Codes never use 0, O, 1, I or L, but we let the server say so.
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            setError(null);
          }}
          onKeyDown={(e) => {
            // The Esc shortcut is switched off while typing in a box, so handle it here.
            if (e.key === 'Escape') navigate('/multiplayer/custom');
          }}
        />
        <p id="room-code-error" className="join__error" role="alert">
          {error ? MESSAGES[error] : ''}
        </p>
        <p className="join__hint">{busy ? 'Joining...' : 'Press Enter to join, or Esc to go back.'}</p>
      </form>
    </ScreenLayout>
  );
}
