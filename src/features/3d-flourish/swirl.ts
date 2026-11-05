/**
 * Math for the pixel swirl background. No React or DOM here, so the look is
 * easy to tune, and the same code runs in the background thread
 * (swirl.worker.ts) and in the main-thread fallback. A "cell" is one chunky
 * pixel of the swirl.
 *
 * Bands (each mapped to a color by SwirlBackground):
 *   0 = empty space   --color-screen
 *   1 = faint arm     --color-light
 *   2 = arm           --color-outline-light
 *   3 = core / stars  --color-accent
 */

/** Screen pixels per swirl cell (medium chunkiness). */
export const CELL_SIZE = 8
/** Upper limit on cells, so very large screens use bigger cells instead. */
export const MAX_CELLS = 60_000

const ARMS = 3
/** How tightly the arms wind around the center. */
const TWIST = 2.2
/** Arm strength needed for each band (0..1). */
const FAINT_ARM = 0.55
const ARM = 0.8
/** Core sizes, as a share of the swirl's radius. */
const CORE_RADIUS = 0.13
const CORE_HOLE = 0.05

export type SwirlVariant = 'full' | 'faded'

export interface SwirlStyle {
  /** Frames drawn per second when animated. */
  fps: number
  /** Seconds for one full turn. */
  turnSeconds: number
  /** Share of cells that are "stars". */
  starDensity: number
  /** Stars blink (full) or stay dim (faded). */
  twinkle: boolean
  /** Draw the bright core ring at the center. */
  core: boolean
  /**
   * How far each color moves from --color-screen toward its token (1 = the
   * token itself). Used by SwirlBackground when it reads the colors.
   */
  colorStrength: number
  /** Separate strength for core/star color (band 3). */
  accentStrength: number
}

export const SWIRL_STYLES: Record<SwirlVariant, SwirlStyle> = {
  // Home: steppy, warm, with an orange core and blinking stars.
  full: { fps: 12, turnSeconds: 60, starDensity: 0.012, twinkle: true, core: true, colorStrength: 1, accentStrength: 1 },
  // Other screens: barely there, slower, no core, a few dim still stars.
  faded: { fps: 6, turnSeconds: 120, starDensity: 0.004, twinkle: false, core: false, colorStrength: 0.33, accentStrength: 0.25 },
}

/** Cosine lookup: 256 steps per arm cycle, instead of Math.cos per cell. */
const LUT_SIZE = 256
const COS_LUT = Float32Array.from({ length: LUT_SIZE }, (_, k) => Math.cos((k / LUT_SIZE) * Math.PI * 2))

const CELL_ARM = 0
const CELL_FIXED = 1 // always one band (core, core hole, faded star)
const CELL_STAR = 2 // blinking star

/**
 * Everything about a cell that doesn't change frame to frame, worked out once
 * per window size. Each frame then needs one table lookup per cell.
 */
export interface SwirlGrid {
  cols: number
  rows: number
  /** Cell's spot in the arm cycle, in lookup-table steps (0..255). */
  phase: Uint8Array
  /** cos() must exceed these for band 2 / band 1 (fade toward the edges included). */
  armAt: Float32Array
  faintAt: Float32Array
  kind: Uint8Array
  /** Band for CELL_FIXED cells. */
  fixedBand: Uint8Array
  /** Each blinking star's own offset (radians). */
  twinkle: Float32Array
}

/** Repeatable pseudo-random 0..1 for a cell, so stars stay put between visits. */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function createGrid(cols: number, rows: number, style: SwirlStyle): SwirlGrid {
  const count = cols * rows
  const grid: SwirlGrid = {
    cols,
    rows,
    phase: new Uint8Array(count),
    armAt: new Float32Array(count),
    faintAt: new Float32Array(count),
    kind: new Uint8Array(count),
    fixedBand: new Uint8Array(count),
    twinkle: new Float32Array(count),
  }
  const cx = cols / 2
  const cy = rows / 2
  // The swirl's radius reaches the nearer edge, so it fills the shorter side.
  const radius = Math.min(cols, rows) / 2

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const dx = (x + 0.5 - cx) / radius
      const dy = (y + 0.5 - cy) / radius
      const r = Math.hypot(dx, dy)

      const angle = Math.atan2(dy, dx) - TWIST * Math.log(r + 0.05)
      const steps = Math.round((ARMS * angle * LUT_SIZE) / (Math.PI * 2))
      grid.phase[i] = ((steps % LUT_SIZE) + LUT_SIZE) % LUT_SIZE

      // strength = (cos + 1) / 2 * fade > threshold  <=>  cos > 2 * threshold / fade - 1
      const fade = Math.min(1, Math.max(0.35, 1.25 - r * 0.35))
      grid.armAt[i] = (2 * ARM) / fade - 1
      grid.faintAt[i] = (2 * FAINT_ARM) / fade - 1

      const h = hash(x, y)
      if (style.core && r < CORE_HOLE) {
        grid.kind[i] = CELL_FIXED
        grid.fixedBand[i] = 1
      } else if (style.core && r < CORE_RADIUS) {
        grid.kind[i] = CELL_FIXED
        grid.fixedBand[i] = 3
      } else if (h < style.starDensity) {
        if (style.twinkle) {
          grid.kind[i] = CELL_STAR
          grid.twinkle[i] = (h / style.starDensity) * Math.PI * 2
        } else {
          grid.kind[i] = CELL_FIXED
          grid.fixedBand[i] = 3
        }
      }
    }
  }
  return grid
}

/**
 * Fills `pixels` (one packed RGBA color per cell) for `seconds` since the
 * swirl started. `colors` holds the 4 band colors.
 */
export function renderFrame(
  grid: SwirlGrid,
  pixels: Uint32Array,
  colors: Uint32Array,
  seconds: number,
  style: SwirlStyle,
): void {
  const spinSteps = Math.floor((ARMS * LUT_SIZE * seconds) / style.turnSeconds) % LUT_SIZE
  const { phase, armAt, faintAt, kind } = grid
  const c0 = colors[0]
  const c1 = colors[1]
  const c2 = colors[2]
  const c3 = colors[3]

  for (let i = 0; i < pixels.length; i++) {
    const k = kind[i]
    if (k === CELL_ARM) {
      const c = COS_LUT[(phase[i] - spinSteps + LUT_SIZE) & (LUT_SIZE - 1)]
      pixels[i] = c > armAt[i] ? c2 : c > faintAt[i] ? c1 : c0
    } else if (k === CELL_FIXED) {
      pixels[i] = colors[grid.fixedBand[i]]
    } else {
      pixels[i] = Math.sin(seconds * 0.8 + grid.twinkle[i]) > 0.2 ? c3 : c1
    }
  }
}

/** Grid size for a box, using CELL_SIZE but staying under MAX_CELLS. */
export function gridSize(width: number, height: number): { cols: number; rows: number } {
  let cell = CELL_SIZE
  while (Math.ceil(width / cell) * Math.ceil(height / cell) > MAX_CELLS) cell += 1
  return { cols: Math.max(1, Math.ceil(width / cell)), rows: Math.max(1, Math.ceil(height / cell)) }
}
