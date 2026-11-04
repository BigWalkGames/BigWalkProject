import { useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { claimScreen, getState, releaseScreen, reset, subscribe, type EndReason } from './quickMatch';

const NOTICES: Record<EndReason, string> = {
  no_opponent: 'No opponent was found. Try again in a moment.',
  opponent_left: 'Your opponent left the match.',
  room_closed: 'The room closed because nobody started a match.',
  connection_lost: 'The connection to the server was lost.',
  connect_failed: 'Could not connect to the server.',
};

// Custom Game: the room closes when the other player leaves, so say so.
const CUSTOM_OPPONENT_LEFT = 'Your friend left, so the room was closed.';

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
    const notice =
      state.endReason === 'opponent_left' && state.mode === 'custom'
        ? CUSTOM_OPPONENT_LEFT
        : NOTICES[state.endReason];
    reset();
    navigate('/', { replace: true, state: { notice } });
  }, [state.endReason, state.mode, navigate]);

  return state;
}
