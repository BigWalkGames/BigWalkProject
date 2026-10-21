import { Client } from '@colyseus/sdk';

/**
 * Quick Match connection (P15, P16, P17, P18, P19, P21).
 *
 * One Quick Match at a time. The state lives here, outside React, so it survives
 * moving from the waiting screen to the Versus screen. Screens read it with the
 * `useQuickMatch` hook (see useQuickMatch.ts) and never talk to Colyseus directly.
 *
 * The events match the server (see QUICK_MATCH.md in the multiplayer folder).
 */

// Where the multiplayer server is. For staging, set VITE_MULTIPLAYER_URL in .env
// (for example wss://the-staging-address). Local development uses the local server.
const SERVER_URL: string = import.meta.env.VITE_MULTIPLAYER_URL ?? 'ws://localhost:2567';

export type MatchFound = {
  players: string[];
  words: string[];
  countdownSeconds: number;
  durationSeconds: number;
};

/** wordResults: one letter per completed word, "g" no mistakes, "r" had a mistake. */
export type Progress = { typed: number; correct: number; wordResults?: string };

export type PlayerResult = { wpm: number; accuracy: number; correct: number; typed: number };

/** winner is a player's sessionId, or null for a draw. results is keyed by sessionId. */
export type MatchResult = { winner: string | null; results: Record<string, PlayerResult> };

export type QuickMatchStatus = 'idle' | 'searching' | 'countdown' | 'racing' | 'finished';

/** Why the player is being sent back to the Main Menu. */
export type EndReason = 'no_opponent' | 'opponent_left' | 'connection_lost' | 'connect_failed';

export type QuickMatchState = {
  status: QuickMatchStatus;
  sessionId: string | null;
  match: MatchFound | null;
  countdown: number | null;
  /** Local clock time (ms) when "go" arrived. Only used for the on-screen timer. */
  raceStartedAt: number | null;
  opponent: Progress;
  result: MatchResult | null;
  endReason: EndReason | null;
};

const initialState: QuickMatchState = {
  status: 'idle',
  sessionId: null,
  match: null,
  countdown: null,
  raceStartedAt: null,
  opponent: { typed: 0, correct: 0 },
  result: null,
  endReason: null,
};

type ClientRoom = Awaited<ReturnType<Client['joinOrCreate']>>;

let state: QuickMatchState = initialState;
const listeners = new Set<() => void>();
let room: ClientRoom | null = null;
let leaving = false; // true when WE closed the connection on purpose
let searchId = 0; // lets a stale search notice it was cancelled

function setState(patch: Partial<QuickMatchState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState() {
  return state;
}

function closeRoom() {
  if (!room) return;
  const closing = room;
  room = null;
  leaving = true;
  void Promise.resolve(closing.leave()).catch(() => {});
}

/** The match is over for a bad reason. The screens send the player to the Main Menu. */
function endMatch(reason: EndReason) {
  closeRoom();
  setState({ endReason: reason });
}

/** Leave any match and go back to a clean slate. */
export function reset() {
  searchId += 1;
  closeRoom();
  setState(initialState);
}

/** Join the Quick Match queue. Safe to call twice in a row (React dev mode does). */
export async function startSearch() {
  if (state.status === 'finished') reset();
  if (state.status !== 'idle') return;

  const mine = ++searchId;
  setState({ ...initialState, status: 'searching' });

  let joined: ClientRoom;
  try {
    joined = await new Client(SERVER_URL).joinOrCreate('quick_match');
  } catch {
    if (mine === searchId) endMatch('connect_failed');
    return;
  }

  // The player may have left the screen while we were still connecting.
  if (mine !== searchId) {
    void Promise.resolve(joined.leave()).catch(() => {});
    return;
  }

  attach(joined);
}

function attach(joined: ClientRoom) {
  room = joined;
  leaving = false;
  setState({ sessionId: joined.sessionId });

  // Every handler is registered right here, straight after joining, so no message
  // from the server can arrive before it has a listener.
  joined.onMessage('match_found', (match: MatchFound) => setState({ match }));
  joined.onMessage('countdown', ({ seconds }: { seconds: number }) =>
    setState({ status: 'countdown', countdown: seconds }),
  );
  joined.onMessage('go', () =>
    setState({ status: 'racing', countdown: null, raceStartedAt: Date.now() }),
  );
  joined.onMessage('opponent_progress', (opponent: Progress) => setState({ opponent }));
  joined.onMessage('match_result', (result: MatchResult) =>
    setState({ status: 'finished', result }),
  );
  joined.onMessage('opponent_left', () => endMatch('opponent_left'));
  joined.onMessage('no_opponent', () => endMatch('no_opponent'));

  // The server also closes the room after results, after "no opponent", and after
  // "opponent left". Those are expected. Anything else is a lost connection (P18).
  joined.onLeave(() => {
    if (room !== joined) return;
    room = null;
    if (!leaving && !state.result && !state.endReason) endMatch('connection_lost');
  });
}

/** Send the player's running totals since "go". Call at most about 10 times a second. */
export function sendProgress(typed: number, correct: number, wordResults: string) {
  room?.send('progress', { typed, correct, wordResults });
}

// A screen that is part of Quick Match "claims" the session while it is on screen.
// If no screen claims it for a moment (the player went elsewhere), we leave the match.
// The short delay lets one Quick Match screen hand over to the next without leaving.
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

export function claimScreen() {
  clearTimeout(releaseTimer);
}

export function releaseScreen() {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(reset, 150);
}
