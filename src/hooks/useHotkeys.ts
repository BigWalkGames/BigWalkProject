import { useEffect, useRef } from 'react';
import { playSound } from '../features/audio/sound';

/** An action can return false to say it was ignored (no click plays); anything else counts as handled. */
type HotkeyMap = Record<string, () => unknown>;

type Options = {
  allowRepeat?: boolean;
  enabled?: boolean;
  /** Play the menu select click (Esc: the back click) when a hotkey fires. Default true. */
  sound?: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export function useHotkeys(map: HotkeyMap, options: Options = {}) {
  const { allowRepeat = false, enabled = true, sound = true } = options;

  const mapRef = useRef(map);
  useEffect(() => {
    mapRef.current = map;
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat && !allowRepeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; 
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      const action = mapRef.current[key];
      if (action) {
        e.preventDefault();
        const handled = action() !== false;
        if (handled && sound) playSound(key === 'escape' ? 'menuBack' : 'menuSelect');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allowRepeat, enabled, sound]);
}