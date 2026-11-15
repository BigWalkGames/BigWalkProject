import { useSyncExternalStore } from 'react';
import { DEFAULT_EMOTE_SLOTS, isEmoteId, type EmoteId, type EmoteSlot } from './emotes';

/** Which emote each arrow key sends. Saved on this device. */
export type EmoteSlots = Record<EmoteSlot, EmoteId>;

const STORAGE_KEY = 'bigwalk.emoteSlots';

function clean(raw: unknown, base: EmoteSlots): EmoteSlots {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<EmoteSlot, unknown>>;
  const slots = { ...base };
  for (const slot of Object.keys(slots) as EmoteSlot[]) {
    const id = saved[slot];
    if (isEmoteId(id)) slots[slot] = id;
  }
  return slots;
}

function read(): EmoteSlots {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return clean(JSON.parse(raw), DEFAULT_EMOTE_SLOTS);
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return DEFAULT_EMOTE_SLOTS;
}

let current = read();
const listeners = new Set<() => void>();
const editListeners = new Set<(slots: EmoteSlots) => void>();

function store(next: EmoteSlots) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or unavailable: the choice lasts until reload.
  }
  for (const listener of listeners) listener();
}

/** A change made by the player (setEmoteSlot, resetEmoteSlots). */
function save(next: EmoteSlots) {
  store(next);
  for (const listener of editListeners) listener(current);
}

/** Slots loaded from the player's account. Not reported as an edit. */
export function applyRemoteEmoteSlots(raw: unknown) {
  store(clean(raw, current));
}

export function onEmoteSlotsEdited(listener: (slots: EmoteSlots) => void) {
  editListeners.add(listener);
  return () => {
    editListeners.delete(listener);
  };
}

/** Put a different emote on one arrow key. */
export function setEmoteSlot(slot: EmoteSlot, id: EmoteId) {
  save({ ...current, [slot]: id });
}

export function resetEmoteSlots() {
  save(DEFAULT_EMOTE_SLOTS);
}

/** The current choice, read by the key handler at the moment a key is pressed. */
export function getEmoteSlots(): EmoteSlots {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEmoteSlots(): EmoteSlots {
  return useSyncExternalStore(subscribe, () => current);
}
