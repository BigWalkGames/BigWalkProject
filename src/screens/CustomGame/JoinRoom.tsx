import { useState } from 'react';
import { useNavigate } from 'react-router';
import { NavButton } from '../../components/NavButton/NavButton';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { useHotkeys } from '../../hooks/useHotkeys';
import { joinRoom, type JoinError } from '../../net/quickMatch';
import './CustomGame.css';

const MESSAGES: Record<JoinError, string> = {
  invalid: "That code isn't right. Check it and try again.",
  full: 'That room is full.',
  expired: 'That room has closed. Ask your friend for a new code.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  connect_failed: 'Could not connect to the server.',
};

/** Letters and numbers only, upper case. */
const clean = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Finds a room code in text copied from somewhere (a Discord message like "join me: K7M2P").
 * A code is 5 characters from the room code alphabet (no 0, O, 1, I or L) standing on its own.
 * Returns null when there is none.
 */
function findCode(text: string): string | null {
  return text.toUpperCase().match(/(?<![A-Z0-9])[A-HJ-KM-NP-Z2-9]{5}(?![A-Z0-9])/)?.[0] ?? null;
}

/** P27: type a friend's room code. A bad code shows its error here and keeps you on this screen. */
export default function JoinRoom() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<JoinError | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  /**
   * Fill the box from the clipboard (the Paste button, or the V key) and join straight away
   * when it holds a room code. With `typeVIfEmpty`, the V key still types a V when the
   * clipboard holds no code, because codes can start with V.
   */
  async function paste(typeVIfEmpty = false) {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      if (typeVIfEmpty) setCode('V');
      else setNote("Couldn't read your clipboard. Click the box and press Ctrl+V (Cmd+V on Mac).");
      return;
    }
    const found = findCode(text);
    if (found) {
      setCode(found);
      setError(null);
      setNote('');
      void join(found);
    } else if (typeVIfEmpty) {
      setCode('V');
    } else if (clean(text)) {
      setCode(clean(text).slice(0, 5)); // not a valid code; the server will say so
      setError(null);
      setNote('');
    } else {
      setNote('Your clipboard has no room code. Copy the code first.');
    }
  }

  // V works when the box is not focused (the box itself handles V below).
  useHotkeys({ v: () => void paste() });

  /** Join a room by code. A bad code shows its error here and keeps you on this screen. */
  async function join(value: string) {
    if (busy) return;
    if (value.length !== 5) {
      setError('invalid');
      return;
    }
    setBusy(true);
    const problem = await joinRoom(value);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    navigate('/multiplayer/custom/lobby', { replace: true });
  }

  const submit = () => join(code);

  return (
    <ScreenLayout
      title="Join Room"
      backTo="/multiplayer/custom"
      footer={
        <NavButton hotkey="V" onClick={() => void paste()}>
          Paste
        </NavButton>
      }
    >
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
            setCode(clean(e.target.value));
            setError(null);
            setNote('');
          }}
          onPaste={(e) => {
            // Ctrl+V / Cmd+V: pick the code out of whatever was copied, instead of cutting it off at 5 characters.
            const text = e.clipboardData.getData('text');
            e.preventDefault();
            const found = findCode(text);
            setCode(found ?? clean(text).slice(0, 5));
            setError(null);
            setNote('');
            if (found) void join(found); // a pasted code joins right away, no Enter needed
          }}
          onKeyDown={(e) => {
            // V on an empty box pastes. If there is no code on the clipboard it types a V instead.
            if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey && code === '') {
              e.preventDefault();
              void paste(true);
              return;
            }
            // The Esc shortcut is switched off while typing in a box, so handle it here.
            if (e.key === 'Escape') navigate('/multiplayer/custom');
          }}
        />
        <p id="room-code-error" className="join__error" role="alert">
          {error ? MESSAGES[error] : ''}
        </p>
        <p className="join__hint">
          {busy ? 'Joining...' : note || 'Copied the code? Press V to paste it and join. Or type it and press Enter. Esc goes back.'}
        </p>
      </form>
    </ScreenLayout>
  );
}
