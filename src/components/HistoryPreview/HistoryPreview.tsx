import './HistoryPreview.css';
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { MenuButton } from '../MenuButton/MenuButton';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import { usePrefersReducedMotion } from '../../features/3d-flourish/usePrefersReducedMotion';

const SPEED = 30;         // px per second, about one row every 3 s
const END_PAUSE = 2000;   // ms to wait at the bottom, and back at the top, before moving again

/**
 * Slowly scrolls `ref` down, pauses at the bottom, goes back to the top and
 * starts again. Does nothing when everything fits, while the pointer or focus
 * is on the list, or when the player asks for reduced motion.
 */
function useAutoScroll(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let paused = false;
    const pause = () => { paused = true; };
    const resume = () => { paused = el.matches(':hover, :focus-within'); };
    el.addEventListener('pointerenter', pause);
    el.addEventListener('pointerleave', resume);
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', resume);

    let frame = 0;
    let last = performance.now();
    let waitUntil = last + END_PAUSE;
    let pos = el.scrollTop; // fractional position; scrollTop rounds

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100); // a hidden tab doesn't jump on return
      last = now;
      const max = el.scrollHeight - el.clientHeight;

      if (paused || max <= 0) {
        pos = el.scrollTop; // follow any manual scrolling
      } else if (now >= waitUntil) {
        if (pos >= max - 1) {
          // At the bottom: back to the top, then wait there.
          el.scrollTo({ top: 0, behavior: 'smooth' });
          pos = 0;
          waitUntil = now + END_PAUSE;
        } else {
          pos = Math.min(max, pos + (SPEED * dt) / 1000);
          el.scrollTop = pos;
          if (pos >= max - 1) waitUntil = now + END_PAUSE;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerenter', pause);
      el.removeEventListener('pointerleave', resume);
      el.removeEventListener('focusin', pause);
      el.removeEventListener('focusout', resume);
    };
  }, [ref, enabled]);
}

/**
 * The Solo menu's history panel: every Time Attack result, newest first, with a
 * header button (hotkey H, handled by the screen) that opens the full History page.
 */
export function HistoryPreview() {
  const { entries, status } = useMatchHistory('all');
  const listRef = useRef<HTMLOListElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  useAutoScroll(listRef, !status && !reducedMotion);

  return (
    <section className="history-preview" aria-label="Recent history">
      <div className="history-preview__header">
        <MenuButton hotkey="H" to="/history">
          History
        </MenuButton>
      </div>

      {status ? (
        <p className="history-preview__status">{status}</p>
      ) : (
        <ol className="history-preview__list" ref={listRef}>
          {entries.map((e, i) => (
            <li key={e.id} className="history-preview__row" style={{ '--row-i': Math.min(i, 4) } as CSSProperties}>
              <span className="history-preview__date">{e.date}</span>
              <span className="history-preview__stats">
                <span>{e.wpm}<span className="history-preview__unit">wpm</span></span>
                <span>{e.accuracy}%<span className="history-preview__unit">acc</span></span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
