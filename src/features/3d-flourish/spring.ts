/** A 1D spring for "pop" motion: a little overshoot, then it settles. */
export interface Spring {
  value: number
  velocity: number
}

export function createSpring(value: number): Spring {
  return { value, velocity: 0 }
}

/**
 * Moves the spring toward `target` by `dt` seconds. `dt` is capped so a long
 * pause (e.g. a background tab) doesn't make it jump wildly.
 */
export function stepSpring(
  spring: Spring,
  target: number,
  dt: number,
  stiffness = 260,
  damping = 15,
): void {
  const step = Math.min(dt, 1 / 30)
  const accel = stiffness * (target - spring.value) - damping * spring.velocity
  spring.velocity += accel * step
  spring.value += spring.velocity * step
}

/** True once the spring is at rest on its target. */
export function isSettled(spring: Spring, target: number): boolean {
  return Math.abs(target - spring.value) < 0.01 && Math.abs(spring.velocity) < 0.01
}
