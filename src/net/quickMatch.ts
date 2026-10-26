import { Client } from '@colyseus/sdk';
import { getSupabase } from '../lib/supabase';

/**
 * Quick Match connection (P15, P16, P17, P18, P19, P21).
 *
 * One Quick Match at a time. The state lives here, outside React, so it survives
 * moving from the waiting screen to the Versus screen. Screens read it with the
 * `useQuickMatch` hook (see useQuickMatch.ts) and never talk to Colyseus directly.
 *
 * The events match the server (see QUICK_MATCH.md in the multiplayer folder).
 *
 * Custom Game (P26-P29) uses the same store: a private room two friends join with a
 * code. It adds a "lobby" status before the countdown; everything after "match_found"
 * is the same as Quick Match. See DOCUMENT_CUSTOM_GAME.md in the multiplayer folder.
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
export type MatchResult = {
  winner: string | null;
  results: Record<string, PlayerResult>;
  /** How long the race really lasted. Shorter than the full time when someone finished the text. */
  durationSeconds?: number;
};

export type QuickMatchStatus = 'idle' | 'searching' | 'lobby' | 'countdown' | 'racing' | 'finished';

/** quick = random opponent, custom = a private room joined with a code. */
export type MatchMode = 'quick' | 'custom';

/** Why the player is being sent back to the Main Menu. */
export type EndReason =
  | 'no_opponent'
  | 'opponent_left'
  | 'room_closed'
  | 'connection_lost'
  | 'connect_failed';

/** Why a room code could not be used. Shown on the Join Room screen. */
export type JoinError = 'invalid' | 'full' | 'expired' | 'rate_limited' | 'connect_failed';

export type LobbyPlayer = { id: string; ready: boolean };
export type Lobby = { code: string; players: LobbyPlayer[] };

export type QuickMatchState = {
  status: QuickMatchStatus;
  mode: MatchMode;
  /** Custom Game only: the room code and who is in the room. */
  lobby: Lobby | null;
  sessionId: string | null;
  match: MatchFound | null;
  countdown: number | null;
  /** Local clock time (ms) when "go" arrived. Only used for the on-screen timer. */
  raceStartedAt: number | null;
  opponent: Progress;
  result: MatchResult | null;
  endReason: EndReason | null;
  /** Goes up with every match, so the Versus screen starts a fresh race for a rematch. */
  matchNumber: number;
  /** Custom Game: the room closed while the results were showing (the friend left). */
  roomEnded: boolean;
};

const initialState: QuickMatchState = {
  status: 'idle',
  mode: 'quick',
  lobby: null,
  sessionId: null,
  match: null,
  countdown: null,
  raceStartedAt: null,
  opponent: { typed: 0, correct: 0 },
  result: null,
  endReason: null,
  matchNumber: 0,
  roomEnded: false,
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

/**
 * The match is over for a bad reason. The screens send the player to the Main Menu.
 * Exception: a Custom Game friend leaving while the results are showing. The player keeps
 * reading the results, and the screen says the room is closed.
 */
function endMatch(reason: EndReason) {
  closeRoom();
  if (state.mode === 'custom' && state.status === 'finished' && reason !== 'connect_failed') {
    setState({ roomEnded: true });
    return;
  }
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
    joined = await new Client(SERVER_URL).joinOrCreate('quick_match', await joinOptions());
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

/**
 * The player's sign-in token. The server only checks it when it runs with
 * REQUIRE_AUTH=true; otherwise it is ignored. No session (or no Supabase) means
 * no token, and a server that wants one will say no.
 */
async function joinOptions(): Promise<{ token?: string }> {
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    return token ? { token } : {};
  } catch {
    return {};
  }
}

/** Create a private Custom Game room. The code is in `state.lobby.code` once it is made. */
export async function createRoom() {
  if (state.status === 'finished') reset();
  if (state.status !== 'idle') return;

  const mine = ++searchId;
  setState({ ...initialState, mode: 'custom', status: 'searching' });

  let created: ClientRoom;
  try {
    created = await new Client(SERVER_URL).create('custom_game', await joinOptions());
  } catch {
    if (mine === searchId) endMatch('connect_failed');
    return;
  }

  if (mine !== searchId) {
    void Promise.resolve(created.leave()).catch(() => {});
    return;
  }

  attach(created);
}

/** The server's address for plain web requests, for the same server as the game. */
function httpUrl() {
  return SERVER_URL.replace(/^ws/, 'http').replace(/\/+$/, '');
}

/**
 * Join a friend's room. Returns null once joined (the state is then "lobby"), or the
 * reason the code can't be used so the Join Room screen can show it and stay put.
 */
export async function joinRoom(input: string): Promise<JoinError | null> {
  const code = input.trim().toUpperCase();
  if (state.status === 'finished') reset();
  if (state.status !== 'idle') return 'connect_failed';

  // Ask first, so a wrong, closed or full code gets its own message.
  let status: string;
  try {
    const response = await fetch(`${httpUrl()}/api/room-code/status?code=${encodeURIComponent(code)}`);
    if (!response.ok) return 'connect_failed';
    status = ((await response.json()) as { status?: string }).status ?? '';
  } catch {
    return 'connect_failed';
  }
  if (status === 'invalid' || status === 'full' || status === 'expired' || status === 'rate_limited') {
    return status;
  }
  if (status !== 'open') return 'connect_failed';

  const mine = ++searchId;
  setState({ ...initialState, mode: 'custom', status: 'searching' });

  let joined: ClientRoom;
  try {
    joined = await new Client(SERVER_URL).joinById(code, await joinOptions());
  } catch {
    // Someone may have taken the last seat, or the room closed, since we asked.
    if (mine === searchId) setState({ ...initialState });
    return 'full';
  }

  if (mine !== searchId) {
    void Promise.resolve(joined.leave()).catch(() => {});
    return 'connect_failed';
  }

  attach(joined);
  return null;
}

/** Custom Game: say you are ready (or not). The match starts when both players are. */
export function setReady(ready: boolean) {
  room?.send('ready', { ready });
}

function attach(joined: ClientRoom) {
  room = joined;
  leaving = false;
  setState({
    sessionId: joined.sessionId,
    // A Custom Game room starts in its lobby, and its id is the room code.
    ...(state.mode === 'custom'
      ? { status: 'lobby' as const, lobby: { code: joined.roomId, players: [] } }
      : {}),
  });

  // Every handler is registered right here, straight after joining, so no message
  // from the server can arrive before it has a listener.
  joined.onMessage('lobby', (lobby: Lobby) => setState({ lobby }));
  // A rematch sends a new match_found: start from a clean slate for the new race.
  joined.onMessage('match_found', (match: MatchFound) =>
    setState({
      match,
      result: null,
      opponent: { typed: 0, correct: 0 },
      countdown: null,
      raceStartedAt: null,
      matchNumber: state.matchNumber + 1,
    }),
  );
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
  joined.onMessage('room_closed', () => endMatch('room_closed'));

  // The server also closes the room after results, after "no opponent", and after
  // "opponent left". Those are expected. Anything else is a lost connection (P18).
  joined.onLeave(() => {
    if (room !== joined) return;
    room = null;
    if (leaving) return;
    if (state.mode === 'custom' && state.status === 'finished') setState({ roomEnded: true });
    else if (!state.result && !state.endReason) endMatch('connection_lost');
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
