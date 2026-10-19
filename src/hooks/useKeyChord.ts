import { useEffect, useRef } from 'react';

export function useKeyChord(keys: string[], onChord: () => void) {

  const callback = useRef(onChord);
  useEffect(() => {
    callback.current = onChord;
  });

  const combo = keys.join(',').toLowerCase();

  useEffect(() => {
    const wanted = combo.split(',');
    const down = new Set<string>();
    let fired = false;

    const allDown = () => wanted.every((k) => down.has(k));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      down.add(e.key.toLowerCase());
      if (!fired && allDown()) {
        fired = true; 
        callback.current();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      down.delete(e.key.toLowerCase());
      if (!allDown()) fired = false;
    };

    const reset = () => {
      down.clear();
      fired = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', reset);
    };
  }, [combo]);
}