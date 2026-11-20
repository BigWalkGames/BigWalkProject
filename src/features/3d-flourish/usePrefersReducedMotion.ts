import { useReducedMotion } from '../accessibility/accessibilitySettings'

/**
 * True when animations should be skipped: the Motion Reduction setting (Settings >
 * Accessibility) is on, or the player's device asks for reduced motion.
 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion()
}
