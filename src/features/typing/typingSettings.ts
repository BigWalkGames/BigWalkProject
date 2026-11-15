import { useSyncExternalStore } from 'react';

/** How the cursor moves between letters: 'off' jumps, the others slide. */
export type CaretSpeed = 'off' | 'fast' | 'medium' | 'slow';

export interface TypingSettings {
  caretSpeed: CaretSpeed;
  /** Slide the words up when moving to the next line, instead of jumping. */
  smoothLines: boolean;
}

/** Slide length per caret speed. Long enough to glide, short enough to keep up at 150+ WPM. */
export const CARET_SLIDE_MS: Record<CaretSpeed, number> = {
  off: 0,
  fast: 70,
  medium: 100,
  slow: 150,
};

/** How long the words take to slide up one line. */
export const LINE_SLIDE_MS = 125;

const STORAGE_KEY = 'bigwalk.typingSettings';
const DEFAULTS: TypingSettings = { caretSpeed: 'medium', smoothLines: true };
const CARET_SPEEDS: readonly CaretSpeed[] = ['off', 'fast', 'medium', 'slow'];

/** `raw` over `base`, keeping only valid values. Saved data can be old, edited or from another device. */
function clean(raw: unknown, base: TypingSettings): TypingSettings {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    caretSpeed: CARET_SPEEDS.includes(saved.caretSpeed as CaretSpeed)
      ? (saved.caretSpeed as CaretSpeed)
      : base.caretSpeed,
    smoothLines: typeof saved.smoothLines === 'boolean' ? saved.smoothLines : base.smoothLines,
  };
}

function read(): TypingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return clean(JSON.parse(raw), DEFAULTS);
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return DEFAULTS;
}

let current = read();
const listeners = new Set<() => void>();
const editListeners = new Set<(settings: TypingSettings) => void>();

function store(next: TypingSettings) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or unavailable: the setting lasts until reload.
  }
  for (const listener of listeners) listener();
}

/** A change made by the player. Saved here and reported to the account sync. */
export function setTypingSettings(patch: Partial<TypingSettings>) {
  store(clean(patch, current));
  for (const listener of editListeners) listener(current);
}

/** Settings loaded from the player's account. Not reported as an edit, so they aren't saved straight back. */
export function applyRemoteTypingSettings(raw: unknown) {
  store(clean(raw, current));
}

export function getTypingSettings(): TypingSettings {
  return current;
}

export function onTypingSettingsEdited(listener: (settings: TypingSettings) => void) {
  editListeners.add(listener);
  return () => {
    editListeners.delete(listener);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTypingSettings(): TypingSettings {
  return useSyncExternalStore(subscribe, () => current);
}
