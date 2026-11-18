import { useLayoutEffect, useRef } from 'react';
import { countUpValue } from './countUpMath';

/**
 * A number that counts up from 0 when `animate` is on, otherwise shows its value.
 * The counting writes straight into the page each frame (no React re-renders).
 * Screen readers get the final value right away, never the counting.
 */
export function CountUp({
  value,
  suffix = '',
  animate,
  delayMs = 0,
  durationMs = 600,
}: {
  value: number;
  suffix?: string;
  animate: boolean;
  delayMs?: number;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = (n: number) => { el.textContent = `${n}${suffix}`; };
    if (!animate) {
      show(value);
      return;
    }
    show(0);
    const start = performance.now() + delayMs;
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / durationMs;
      show(countUpValue(value, t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, suffix, animate, delayMs, durationMs]);

  return (
    <>
      {/* Filled in by the effect above; React never writes inside it. */}
      <span ref={ref} aria-hidden="true" />
      <span className="versus-sr-only">{`${value}${suffix}`}</span>
    </>
  );
}
