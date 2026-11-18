import { describe, expect, it } from 'vitest';
import { isChatOpen, isTextChatOpen } from './quickMatch';

const players = (n: number) => ({ code: 'ABCDE', players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, ready: false })) });

describe('isChatOpen (P43)', () => {
  it('is closed in the lobby until the friend has joined', () => {
    expect(isChatOpen({ status: 'lobby', lobby: players(0), roomEnded: false })).toBe(false);
    expect(isChatOpen({ status: 'lobby', lobby: players(1), roomEnded: false })).toBe(false);
    expect(isChatOpen({ status: 'lobby', lobby: null, roomEnded: false })).toBe(false);
  });

  it('is open in the lobby with both friends in the room', () => {
    expect(isChatOpen({ status: 'lobby', lobby: players(2), roomEnded: false })).toBe(true);
  });

  it('is open during the countdown and while racing, and closed while searching', () => {
    expect(isChatOpen({ status: 'racing', lobby: null, roomEnded: false })).toBe(true);
    expect(isChatOpen({ status: 'countdown', lobby: null, roomEnded: false })).toBe(true);
    expect(isChatOpen({ status: 'searching', lobby: null, roomEnded: false })).toBe(false);
    expect(isChatOpen({ status: 'idle', lobby: null, roomEnded: false })).toBe(false);
  });

  it('is open on the results until the room ends', () => {
    expect(isChatOpen({ status: 'finished', lobby: null, roomEnded: false })).toBe(true);
    expect(isChatOpen({ status: 'finished', lobby: null, roomEnded: true })).toBe(false);
  });
});

describe('isTextChatOpen (P43)', () => {
  const lobby2 = { code: 'ABCDE', players: [{ id: 'a', ready: false }, { id: 'b', ready: false }] };

  it('needs the server to say it supports typed chat', () => {
    expect(isTextChatOpen({ status: 'lobby', lobby: lobby2, roomEnded: false, textChat: false })).toBe(false);
    expect(isTextChatOpen({ status: 'lobby', lobby: lobby2, roomEnded: false, textChat: true })).toBe(true);
  });

  it('works in the lobby with a friend and on the results, but never while racing', () => {
    expect(isTextChatOpen({ status: 'lobby', lobby: null, roomEnded: false, textChat: true })).toBe(false);
    expect(isTextChatOpen({ status: 'racing', lobby: null, roomEnded: false, textChat: true })).toBe(false);
    expect(isTextChatOpen({ status: 'countdown', lobby: null, roomEnded: false, textChat: true })).toBe(false);
    expect(isTextChatOpen({ status: 'finished', lobby: null, roomEnded: false, textChat: true })).toBe(true);
    expect(isTextChatOpen({ status: 'finished', lobby: null, roomEnded: true, textChat: true })).toBe(false);
  });
});

describe('isTextChatOpen (typed chat)', () => {
  const lobby2 = { code: 'ABCDE', players: [{ id: 'a', ready: false }, { id: 'b', ready: false }] };

  it('needs the server to say it supports typed chat', () => {
    expect(isTextChatOpen({ status: 'lobby', lobby: lobby2, roomEnded: false, textChat: false })).toBe(false);
    expect(isTextChatOpen({ status: 'lobby', lobby: lobby2, roomEnded: false, textChat: true })).toBe(true);
  });

  it('is open in the lobby and on the results, but never while racing', () => {
    expect(isTextChatOpen({ status: 'racing', lobby: null, roomEnded: false, textChat: true })).toBe(false);
    expect(isTextChatOpen({ status: 'finished', lobby: null, roomEnded: false, textChat: true })).toBe(true);
    expect(isTextChatOpen({ status: 'finished', lobby: null, roomEnded: true, textChat: true })).toBe(false);
    expect(isTextChatOpen({ status: 'countdown', lobby: null, roomEnded: false, textChat: true })).toBe(false);
  });

  it('is closed in a lobby that has only one player', () => {
    expect(isTextChatOpen({ status: 'lobby', lobby: { code: 'ABCDE', players: [{ id: 'a', ready: false }] }, roomEnded: false, textChat: true })).toBe(false);
  });
});
