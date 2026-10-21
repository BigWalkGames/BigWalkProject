import { useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { claimScreen, getState, releaseScreen, reset, subscribe, type EndReason } from './quickMatch';

const NOTICES: Record<EndReason, string> = {
  no_opponent: 'No opponent was found. Try again in a moment.',
  opponent_left: 'Your opponent left the match.',
  connection_lost: 'The connection to the server was lost.',
  connect_failed: 'Could not connect to the server.',
};

/**
 * Use this on every screen that is part of a Quick Match. It gives you the current
 * match state, keeps the match alive while the screen is showing, and sends the
 * player back to the Main Menu with a message if the match ends badly
 * (no opponent, opponent left, connection lost).
 */
export function useQuickMatch() {
  const state = useSyncExternalStore(subscribe, getState);
  const navigate = useNavigate();

  useEffect(() => {
    claimScreen();
    return releaseScreen;
  }, []);

  useEffect(() => {
    if (!state.endReason) return;
    const notice = NOTICES[state.endReason];
    reset();
    navigate('/', { replace: true, state: { notice } });
  }, [state.endReason, navigate]);

  return state;
}
