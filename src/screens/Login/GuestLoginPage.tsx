import { useNavigate } from 'react-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../hooks/auth/useAuth';
import { signInAsGuest, signOut } from '../../hooks/auth/authActions';

/**
 * Guest-only login screen: one button, no email or password fields.
 * Uses the same auth layer as AuthTestPage (useAuth + authActions).
 */
export default function GuestLoginPage() {
  const navigate = useNavigate();
  const { user, loading, isGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleGuest = useCallback(async () => {
    setBusy(true);
    setError('');

    const { error } = await signInAsGuest();

    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }

    setBusy(false);
  }, [navigate]);

  // Keyboard shortcut: pressing G to continue as guest
  useEffect(() => {
    // Don't create a guest while checking for a saved session, mid-request, or if already signed in
    if (loading || busy || user) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'g' || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone

      // Ignore typing in form fields
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      handleGuest();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, busy, user, handleGuest]);

  if (loading) return null;

  return (
    <main className="at">
      <section className="at-card" style={{ maxWidth: 420, margin: '0 auto' }}>
        {user ? (
          <>
            <h2>{isGuest ? "You're in as a guest" : "You're signed in"}</h2>
            <button className="danger" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <h2>Welcome</h2>
            <button className="primary" onClick={handleGuest} disabled={busy}>
              {busy ? 'Starting…' : 'Continue as guest'}
            </button>
            <p className="hint">No account needed. You can also press G.</p>
            {error && (
              <div
                className="at-msg err"
                role="alert"
                style={{ marginTop: 12 }}>
                {error}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
