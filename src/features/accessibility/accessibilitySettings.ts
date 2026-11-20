import { useSyncExternalStore } from 'react';

/**
 * Accessibility tab (P45): Colorblind Mode and Motion Reduction.
 *
 * Saved on this device only, like the Audio settings.
 * TODO(server): sync with the account once save_my_settings / get_my_settings accept an
 * `accessibility` section (see features/settings/settingsSync.ts).
 *
 * Not reset for a new guest on this device: these belong to the person using it, and
 * turning animations back on without warning could hurt someone who needs them off.
 */
export interface AccessibilitySettings {
  /** Swap the correct / missed colors (and the heatmap) for a blue / orange pair. */
  colorblind: boolean;
  /** Turn off non-essential animations. The device's own reduce-motion setting does this too. */
  reduceMotion: boolean;
}

export const ACCESSIBILITY_STORAGE_KEY = 'bigwalk.accessibilitySettings';
export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = { colorblind: false, reduceMotion: false };

const SYSTEM_QUERY = '(prefers-reduced-motion: reduce)';

/** `raw` over `base`, keeping only valid values. Saved data can be old or edited. */
export function cleanAccessibilitySettings(raw: unknown, base: AccessibilitySettings): AccessibilitySettings {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    colorblind: typeof saved.colorblind === 'boolean' ? saved.colorblind : base.colorblind,
    reduceMotion: typeof saved.reduceMotion === 'boolean' ? saved.reduceMotion : base.reduceMotion,
  };
}

function read(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (raw) return cleanAccessibilitySettings(JSON.parse(raw), DEFAULT_ACCESSIBILITY_SETTINGS);
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return DEFAULT_ACCESSIBILITY_SETTINGS;
}

let current = read();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function setAccessibilitySettings(patch: Partial<AccessibilitySettings>) {
  current = cleanAccessibilitySettings(patch, current);
  try {
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or unavailable: the setting lasts until reload.
  }
  notify();
}

export function getAccessibilitySettings(): AccessibilitySettings {
  return current;
}

/** Re-reads the saved settings. For tests (a "reload"). */
export function reloadAccessibilitySettings() {
  current = read();
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAccessibilitySettings(): AccessibilitySettings {
  return useSyncExternalStore(subscribe, () => current);
}

// ---------------------------------------------------------------- reduced motion

function systemMedia(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_QUERY) : null;
}

/** True when the device asks for reduced motion. */
export function systemPrefersReducedMotion(): boolean {
  return systemMedia()?.matches === true;
}

/** True when animations should be skipped: Motion Reduction is on, or the device asks for it. */
export function reducedMotionNow(): boolean {
  return current.reduceMotion || systemPrefersReducedMotion();
}

function subscribeMotion(listener: () => void) {
  const media = systemMedia();
  media?.addEventListener('change', listener);
  const unsubscribe = subscribe(listener);
  return () => {
    media?.removeEventListener('change', listener);
    unsubscribe();
  };
}

/** `reducedMotionNow()` as a hook that updates when either the setting or the device changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, reducedMotionNow);
}

/** True when the device itself asks for reduced motion (shown as a note on the Accessibility tab). */
export function useSystemPrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, systemPrefersReducedMotion);
}

// ---------------------------------------------------------------- page attributes

/**
 * Marks the page for CSS: `<html data-colorblind>` and `<html data-reduce-motion>`
 * (the latter also when the device asks for reduced motion). Call once at startup.
 */
export function startAccessibilitySettings() {
  const root = document.documentElement;
  const apply = () => {
    root.toggleAttribute('data-colorblind', current.colorblind);
    root.toggleAttribute('data-reduce-motion', reducedMotionNow());
  };
  apply();
  subscribeMotion(apply);
}
