import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from './countUpMath';

/*
 * End-of-match animation (FLIP: First, Last, Invert, Play).
 *
 * Elements tagged in the page:
 *   data-morph="<key>"     moves from where the element with the same key was in the race
 *                          layout to its new place (cards, pictures, names, chat).
 *   data-morph-kind="box"  also changes size and colors (the result box backgrounds).
 *   data-morph-fade        fades in a little after the move (the result numbers).
 *   data-reveal            fades in and rises, one after another (headline, Word Bank...).
 *
 * The browser runs every animation (element.animate), so no code runs per frame.
 */

export const MORPH_MS = 350;
export const NUMBERS_DELAY_MS = 150;
const NUMBERS_FADE_MS = 200;
export const COUNT_MS = 600;
const REVEAL_DELAY_MS = 200;
const REVEAL_MS = 250;
const REVEAL_STAGGER_MS = 50;
const REVEAL_RISE_PX = 8;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

type Snapshot = Map<string, { rect: DOMRect; background: string; border: string; color: string }>;

/**
 * `ready` turns on when the results arrive. The race layout stays for one more render
 * so the cards can be measured, then `revealed` turns on and the results layout shows
 * (all before the browser paints, so nothing flickers). `animating` stays on until the
 * count-up is over, so things shown later (back from Details) don't animate again.
 */
export function useMatchEndMorph(rootRef: RefObject<HTMLElement | null>, ready: boolean) {
  const [revealed, setRevealed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const before = useRef<Snapshot | null>(null);

  // Step 1 (First): measure the race layout, then switch to the results layout.
  useLayoutEffect(() => {
    if (!ready || revealed) return;
    const root = rootRef.current;
    if (root && !prefersReducedMotion()) {
      before.current = snapshot(root);
      setAnimating(true);
    }
    // Measuring before the browser paints needs a state change right here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealed(true);
  }, [ready, revealed, rootRef]);

  // Steps 2-4 (Last, Invert, Play): measure the results layout and animate from the old spots.
  useLayoutEffect(() => {
    const first = before.current;
    const root = rootRef.current;
    if (!revealed || !first || !root) return;
    before.current = null;
    play(root, first);
    const done = setTimeout(() => setAnimating(false), NUMBERS_DELAY_MS + COUNT_MS + 50);
    return () => clearTimeout(done);
  }, [revealed, rootRef]);

  return { revealed, animating };
}

function snapshot(root: HTMLElement): Snapshot {
  const shots: Snapshot = new Map();
  for (const el of root.querySelectorAll<HTMLElement>('[data-morph]')) {
    const style = getComputedStyle(el);
    shots.set(el.dataset.morph!, {
      rect: el.getBoundingClientRect(),
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color,
    });
  }
  return shots;
}

function play(root: HTMLElement, first: Snapshot) {
  const timing = { duration: MORPH_MS, easing: EASE };

  for (const el of root.querySelectorAll<HTMLElement>('[data-morph]')) {
    const from = first.get(el.dataset.morph!);
    if (!from) continue;
    const to = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const shift = `translate(${from.rect.left - to.left}px, ${from.rect.top - to.top}px)`;

    if (el.dataset.morphKind === 'box') {
      // An empty layer: changing its size is cheap and keeps the corners and border crisp.
      el.animate(
        [
          { transform: shift, width: `${from.rect.width}px`, height: `${from.rect.height}px`, backgroundColor: from.background, borderColor: from.border },
          { transform: 'none', width: `${to.width}px`, height: `${to.height}px`, backgroundColor: style.backgroundColor, borderColor: style.borderColor },
        ],
        timing,
      );
    } else {
      el.animate([{ transform: shift, color: from.color }, { transform: 'none', color: style.color }], timing);
    }
  }

  for (const el of root.querySelectorAll<HTMLElement>('[data-morph-fade]')) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: NUMBERS_FADE_MS, delay: NUMBERS_DELAY_MS, easing: 'ease-out', fill: 'backwards' });
  }

  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) => {
    el.animate(
      [{ opacity: 0, transform: `translateY(${REVEAL_RISE_PX}px)` }, { opacity: 1, transform: 'none' }],
      { duration: REVEAL_MS, delay: REVEAL_DELAY_MS + i * REVEAL_STAGGER_MS, easing: EASE, fill: 'backwards' },
    );
  });
}
