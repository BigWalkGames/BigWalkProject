import { useEffect, useState } from 'react';

export function useKeysDown(keys: string[]): ReadonlySet<string> {
  const watched = keys.join(',').toLowerCase();
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const list = watched.split(',');

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const k = e.key.toLowerCase();
      if (!list.includes(k)) return;
      setDown((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      setDown((prev) => {
        if (!prev.has(k)) return prev;
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    };

    const reset = () => setDown(new Set());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', reset);
    };
  }, [watched]);

  return down;
}