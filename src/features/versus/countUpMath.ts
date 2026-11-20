/** Fast at first, gentle at the end. `t` runs from 0 to 1. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

/** The number to show `t` of the way (0 to 1) through counting from 0 up to `target`. */
export function countUpValue(target: number, t: number): number {
  return Math.round(target * easeOutCubic(t));
}

/** True when animations should be skipped (Motion Reduction setting, or the device asks). */
export { reducedMotionNow as prefersReducedMotion } from '../accessibility/accessibilitySettings';
