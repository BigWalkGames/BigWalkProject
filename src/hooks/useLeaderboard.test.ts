import { describe, expect, it } from 'vitest';
import { filterLeaderboard, parseUtc, toEntry, type LeaderboardEntry } from './useLeaderboard';

// Wednesday, 18 Nov 2026, 3 PM local time
const now = new Date(2026, 10, 18, 15);

const player = (name: string, recentMatch: Date | null, rank: number): LeaderboardEntry => ({
  rank,
  name,
  wpm: 50,
  accuracy: 90,
  wins: 1,
  recentMatch: recentMatch ? recentMatch.getTime() : null,
});

const players = [
  player('today', new Date(2026, 10, 18, 9), 1),
  player('sunday', new Date(2026, 10, 15, 12), 2),
  player('earlier-this-month', new Date(2026, 10, 2, 12), 3),
  player('march', new Date(2026, 2, 10, 12), 4),
  player('last-year', new Date(2025, 11, 31, 12), 5),
  player('never', null, 6),
];

const names = (list: LeaderboardEntry[]) => list.map((p) => p.name);

describe('filterLeaderboard', () => {
  it('keeps everyone, in order, on All', () => {
    expect(filterLeaderboard(players, 'all', now)).toBe(players);
  });

  it('keeps players whose latest match is in the period', () => {
    expect(names(filterLeaderboard(players, 'day', now))).toEqual(['today']);
    expect(names(filterLeaderboard(players, 'week', now))).toEqual(['today', 'sunday']);
    expect(names(filterLeaderboard(players, 'month', now))).toEqual(['today', 'sunday', 'earlier-this-month']);
    expect(names(filterLeaderboard(players, 'year', now))).toEqual(['today', 'sunday', 'earlier-this-month', 'march']);
  });

  it('ranks the filtered list again from 1', () => {
    const month = filterLeaderboard([players[3], players[2]], 'year', now);
    expect(month.map((p) => p.rank)).toEqual([1, 2]);
  });
});

describe('parseUtc', () => {
  it('reads a timestamp without a zone as UTC', () => {
    expect(parseUtc('2026-11-12T04:43:20.314')).toBe(Date.UTC(2026, 10, 12, 4, 43, 20, 314));
    expect(parseUtc('2026-11-12 04:43:20')).toBe(Date.UTC(2026, 10, 12, 4, 43, 20));
  });

  it('respects a zone when there is one', () => {
    expect(parseUtc('2026-11-12T04:43:20Z')).toBe(Date.UTC(2026, 10, 12, 4, 43, 20));
    expect(parseUtc('2026-11-12T04:43:20+02:00')).toBe(Date.UTC(2026, 10, 12, 2, 43, 20));
  });

  it('returns null for missing or bad values', () => {
    expect(parseUtc(null)).toBeNull();
    expect(parseUtc('')).toBeNull();
    expect(parseUtc('not a date')).toBeNull();
  });
});

describe('toEntry', () => {
  it('reads the RPC row, including recent_match', () => {
    const entry = toEntry(
      { username: 'trin', raw_wpm: 92, accuracy: 0.96, wins: 1, effective_wpm: 88.32, recent_match: '2026-11-12T04:43:20.314' },
      0,
    );
    expect(entry).toEqual({
      rank: 1,
      name: 'trin',
      wpm: 92,
      accuracy: 96,
      wins: 1,
      recentMatch: Date.UTC(2026, 10, 12, 4, 43, 20, 314),
    });
  });
});
