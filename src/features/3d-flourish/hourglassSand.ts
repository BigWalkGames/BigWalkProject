/**
 * Sand for the 3D hourglass, in "sprite pixel" units (the hourglass is about
 * 14 x 22 of them, like hourglass.png). y is up, the neck is at y = 0.
 * Pure data and math, no three.js, so it's easy to tune.
 */

export const GRAIN_COUNT = 80
export const GRAIN_SIZE = 0.9

/** Inner radius of the glass at height |y| from the neck. */
export function bulbRadius(distanceFromNeck: number): number {
  const a = Math.abs(distanceFromNeck)
  if (a < 0.6) return 0.9
  return Math.min(4.6, 0.9 + (a - 0.6) * 1.2)
}

export type Vec3 = [number, number, number]

/**
 * Resting spots for grains, in fill order. Grains sit on a 1-unit lattice
 * three deep (z = -1, 0, 1) so the pile reads well from the front.
 * - bottom: from the wide base upward (sand piles on the floor)
 * - top: from the neck upward (sand sits in the funnel above the neck)
 */
function makeSlots(layerYs: number[]): Vec3[] {
  const slots: Vec3[] = []
  for (const y of layerYs) {
    const r = bulbRadius(y) - 0.7
    const layer: Vec3[] = []
    for (let x = -4; x <= 4; x += 1) {
      for (let z = -1; z <= 1; z += 1) {
        if (x * x + z * z <= r * r) layer.push([x, y, z])
      }
    }
    // Center first, so each layer heaps up in the middle.
    layer.sort((a, b) => a[0] ** 2 + a[2] ** 2 - (b[0] ** 2 + b[2] ** 2))
    slots.push(...layer)
  }
  return slots
}

const layers = (from: number, to: number, step: number) => {
  const ys: number[] = []
  for (let y = from; step > 0 ? y <= to : y >= to; y += step) ys.push(y)
  return ys
}

export const BOTTOM_SLOTS = makeSlots(layers(-7.5, -1, 1))
export const TOP_SLOTS = makeSlots(layers(1, 7.5, 1))

/** Where a grain appears when it drops through the neck. */
export const NECK: Vec3 = [0, 0.4, 0]

export type GrainState = 'top' | 'falling' | 'bottom'

export interface Grain {
  state: GrainState
  /** Index into TOP_SLOTS or BOTTOM_SLOTS for resting grains. */
  slot: number
  pos: Vec3
  velocityY: number
}

/** All grains start resting in the top bulb. */
export function createGrains(): Grain[] {
  return Array.from({ length: GRAIN_COUNT }, (_, i) => ({
    state: 'top' as const,
    slot: i,
    pos: [...TOP_SLOTS[i]] as Vec3,
    velocityY: 0,
  }))
}
