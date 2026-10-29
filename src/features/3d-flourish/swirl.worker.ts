/**
 * Draws the swirl background on a background thread (Web Worker), so the
 * animation never runs on the main thread that handles key presses.
 * SwirlBackground transfers its canvas here (OffscreenCanvas) and only sends
 * small messages: setup, new sizes, and pause/resume.
 */
import { createGrid, renderFrame, SWIRL_STYLES, type SwirlGrid, type SwirlVariant } from './swirl'

export type SwirlWorkerMessage =
  | {
      type: 'init'
      canvas: OffscreenCanvas
      variant: SwirlVariant
      colors: Uint32Array
      animated: boolean
      cols: number
      rows: number
    }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'visible'; visible: boolean }

// The project's TypeScript setup has DOM types, not worker types, so describe
// the few worker globals used here.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SwirlWorkerMessage>) => void) | null
  requestAnimationFrame?: (callback: (now: number) => void) => number
}

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let variant: SwirlVariant = 'full'
let colors: Uint32Array = new Uint32Array(4)
let animated = false
let visible = true
let grid: SwirlGrid | null = null
let image: ImageData | null = null
let pixels: Uint32Array | null = null
let lastDraw = -Infinity
let loopRunning = false
const startedAt = performance.now()

function resize(cols: number, rows: number) {
  if (!canvas || !ctx) return
  if (grid && grid.cols === cols && grid.rows === rows) return
  canvas.width = cols
  canvas.height = rows
  grid = createGrid(cols, rows, SWIRL_STYLES[variant])
  image = ctx.createImageData(cols, rows)
  pixels = new Uint32Array(image.data.buffer)
}

function draw() {
  if (!ctx || !grid || !image || !pixels) return
  renderFrame(grid, pixels, colors, (performance.now() - startedAt) / 1000, SWIRL_STYLES[variant])
  ctx.putImageData(image, 0, 0)
}

/** Waits for the next frame, using animation frames when the worker has them. */
function nextFrame(callback: () => void) {
  if (scope.requestAnimationFrame) scope.requestAnimationFrame(callback)
  else setTimeout(callback, 1000 / SWIRL_STYLES[variant].fps)
}

function loop() {
  if (!animated || !visible) {
    loopRunning = false
    return
  }
  const now = performance.now()
  if (now - lastDraw >= 1000 / SWIRL_STYLES[variant].fps) {
    lastDraw = now
    draw()
  }
  nextFrame(loop)
}

function startLoop() {
  if (loopRunning || !animated || !visible) return
  loopRunning = true
  nextFrame(loop)
}

scope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'init') {
    canvas = message.canvas
    ctx = canvas.getContext('2d')
    variant = message.variant
    colors = message.colors
    animated = message.animated
    resize(message.cols, message.rows)
    draw()
    startLoop()
  } else if (message.type === 'resize') {
    resize(message.cols, message.rows)
    draw()
  } else if (message.type === 'visible') {
    visible = message.visible
    startLoop()
  }
}
