import { useEffect, useRef } from 'react';

type HotkeyMap = Record<string, () => void>;

type Options = {
  allowRepeat?: boolean; 
  enabled?: boolean;  
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
  const { allowRepeat = false, enabled = true } = options;

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

      const action = mapRef.current[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allowRepeat, enabled]);
}