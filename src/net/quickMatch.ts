import { Client } from '@colyseus/sdk';
import { getSupabase } from '../lib/supabase';
import { isEmoteId, type EmoteId } from '../features/versus/emotes';

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

/**
 * One line in the match chat: an emote (`id`) or a typed message (`text`, already censored
 * by the server). `from` is the sender's session id; `n` is a running number.
 */
export type Emote = { n: number; from: string } & ({ id: EmoteId; text?: undefined } | { text: string; id?: undefined });

/** Keep the chat short: only the newest ones are kept. */
const MAX_EMOTES = 30;
/** The server drops emotes sent faster than this per player, so don't bother sending them. */
const EMOTE_COOLDOWN_MS = 500;
/** Typed chat: the server's limits (CHAT_COOLDOWN_MS, CHAT_MAX_LENGTH). Matching them here just saves a send. */
const CHAT_COOLDOWN_MS = 1000;
export const CHAT_MAX_LENGTH = 80;

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
  /** The match chat: emotes and typed messages from both players, oldest first. Cleared for every new match. */
  emotes: Emote[];
  /** The server said it understands typed chat. An older server does not, and would disconnect us if we sent it. */
  textChat: boolean;
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
  emotes: [],
  textChat: false,
};

type ClientRoom = Awaited<ReturnType<Client['joinOrCreate']>>;

let state: QuickMatchState = initialState;
const listeners = new Set<() => void>();
let room: ClientRoom | null = null;
let leaving = false; // true when WE closed the connection on purpose
let searchId = 0; // lets a stale search notice it was cancelled
let emoteCount = 0; // numbers the emotes so the chat can tell them apart
let lastEmoteSentAt = 0;
let lastChatSentAt = 0;

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
    textChat: false,
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
      emotes: [],
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
  // P43: an emote from either player (the server sends it to both, the sender too).
  joined.onMessage('emote', (message: { id?: unknown; from?: unknown }) => {
    if (!isEmoteId(message?.id) || typeof message.from !== 'string') return;
    const emote: Emote = { n: ++emoteCount, id: message.id, from: message.from };
    setState({ emotes: [...state.emotes, emote].slice(-MAX_EMOTES) });
  });
  // Typed chat: the server's text, already censored. Shown exactly as it arrives.
  joined.onMessage('chat', (message: { text?: unknown; from?: unknown }) => {
    if (typeof message?.text !== 'string' || typeof message.from !== 'string') return;
    const line: Emote = { n: ++emoteCount, text: message.text.slice(0, CHAT_MAX_LENGTH), from: message.from };
    setState({ emotes: [...state.emotes, line].slice(-MAX_EMOTES) });
  });
  // What this server can do. Only a server that says so gets typed chat.
  joined.onMessage('features', (features: { chat?: unknown }) => {
    setState({ textChat: features?.chat === true });
  });
  joined.onMessage('opponent_left', () => endMatch('opponent_left'));
  joined.onMessage('no_opponent', () => endMatch('no_opponent'));
  joined.onMessage('room_closed', () => endMatch('room_closed'));

  // The server also closes the room after results, after "no opponent", and after
  // "opponent left". Those are expected. Anything else is a lost connection (P18).
  joined.onLeave(() => {
    if (room !== joined) return;
    room = null;
    if (leaving) return;
    // On the results screen the room closing just ends the chat (and the rematch, in Custom Game).
    if (state.status === 'finished') setState({ roomEnded: true });
    else if (!state.result && !state.endReason) endMatch('connection_lost');
  });
}

/** Send the player's running totals since "go". Call at most about 10 times a second. */
/**
 * `errors` = letters still wrong right now (uncorrected), for the doc's Net WPM.
 * Servers that don't read it yet just ignore it.
 */
export function sendProgress(typed: number, correct: number, wordResults: string, errors: number) {
  room?.send('progress', { typed, correct, wordResults, errors });
}

/**
 * Can the player send an emote right now? In the Custom Game lobby once the friend has
 * joined (the server has nobody to send to before that), during the countdown, while
 * racing, and on the results screen until the room closes.
 */
export function isChatOpen(s: Pick<QuickMatchState, 'status' | 'lobby' | 'roomEnded'> = state) {
  if (s.status === 'lobby') return (s.lobby?.players.length ?? 0) >= 2;
  return s.status === 'countdown' || s.status === 'racing' || (s.status === 'finished' && !s.roomEnded);
}

/**
 * Can the player TYPE a message right now? Like emotes, but not during the countdown or
 * the race (the race is about to start, or the keys are typing the words), and only when
 * the server said it supports typed chat.
 */
export function isTextChatOpen(s: Pick<QuickMatchState, 'status' | 'lobby' | 'roomEnded' | 'textChat'> = state) {
  return s.textChat && s.status !== 'racing' && s.status !== 'countdown' && isChatOpen(s);
}

/**
 * P43: send an emote. Works in the lobby, during the countdown, while racing and on the results screen (until
 * the room closes), and at most one every half second (the server's limit). Returns true if sent.
 */
export function sendEmote(id: EmoteId) {
  const chatOpen = isChatOpen();
  if (!room || !chatOpen) return false;
  const now = Date.now();
  if (now - lastEmoteSentAt < EMOTE_COOLDOWN_MS) return false;
  lastEmoteSentAt = now;
  room.send('emote', { id });
  return true;
}

/**
 * Send a typed chat message. The server cleans and censors it and sends it back to both
 * players, so nothing is added to the chat here. At most one a second (the server's
 * limit). Returns true if sent.
 */
export function sendChat(text: string) {
  const message = text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH);
  if (!room || !message || !isTextChatOpen()) return false;
  const now = Date.now();
  if (now - lastChatSentAt < CHAT_COOLDOWN_MS) return false;
  lastChatSentAt = now;
  room.send('chat', { text: message });
  return true;
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
