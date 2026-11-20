import { useSyncExternalStore } from 'react';

/**
 * How long a Time Attack lasts (P48), picked on the Solo menu. The last pick is
 * remembered on this device; the first time it's 30 seconds.
 *
 * TODO(server): the length isn't saved with the result yet. Once save_match_stats
 * accepts it (Justin D's scoring task), send it from supabaseStatsSink and compare
 * high scores per length in usePreviousBest.
 */
export const TIME_ATTACK_LENGTHS = [15, 30, 60] as const;
export type TimeAttackLength = (typeof TIME_ATTACK_LENGTHS)[number];

export const DEFAULT_TIME_ATTACK_LENGTH: TimeAttackLength = 30;
export const TIME_ATTACK_LENGTH_STORAGE_KEY = 'bigwalk.timeAttackLength';

export function isTimeAttackLength(value: unknown): value is TimeAttackLength {
  return (TIME_ATTACK_LENGTHS as readonly unknown[]).includes(value);
}

function read(): TimeAttackLength {
  try {
    const saved = Number(localStorage.getItem(TIME_ATTACK_LENGTH_STORAGE_KEY));
    if (isTimeAttackLength(saved)) return saved;
  } catch {
    // Storage unavailable: use the default.
  }
  return DEFAULT_TIME_ATTACK_LENGTH;
}

let current = read();
const listeners = new Set<() => void>();

/** Picks a length. Anything other than 15, 30 or 60 is ignored. */
export function setTimeAttackLength(length: number) {
  if (!isTimeAttackLength(length) || length === current) return;
  current = length;
  try {
    localStorage.setItem(TIME_ATTACK_LENGTH_STORAGE_KEY, String(length));
  } catch {
    // Storage full or unavailable: the pick lasts until reload.
  }
  for (const listener of listeners) listener();
}

export function getTimeAttackLength(): TimeAttackLength {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTimeAttackLength(): TimeAttackLength {
  return useSyncExternalStore(subscribe, () => current);
}
