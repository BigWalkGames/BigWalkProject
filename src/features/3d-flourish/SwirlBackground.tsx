import { useEffect, useRef } from 'react'
import { createGrid, gridSize, renderFrame, SWIRL_STYLES, type SwirlVariant } from './swirl'
import type { SwirlWorkerMessage } from './swirl.worker'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import './SwirlBackground.css'

/** Design tokens for bands 0-3 (see swirl.ts), with fallbacks. */
const BAND_TOKENS: [string, string][] = [
  ['--color-screen', '#ede7da'],
  ['--color-light', '#e8dcc8'],
  ['--color-outline-light', '#c0a180'],
  ['--color-accent', '#d98e36'],
]

const supportsWorker =
  typeof Worker !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  'transferControlToOffscreen' in HTMLCanvasElement.prototype

/**
 * The animated pixel swirl background. A small canvas (one canvas pixel per
 * swirl cell) is scaled up by CSS into crisp square pixels.
 *
 * - variant "full" (Home) or "faded" (other screens: fainter, slower, calmer)
 * - animated={false} draws one still frame and stops (gameplay screens)
 *
 * Drawing happens in a background thread (swirl.worker.ts), so it never
 * delays key presses. Without worker support, it draws on the main thread:
 * animated for "full", a still frame otherwise. Reduced motion always gets a
 * still frame. Decoration only: hidden from screen readers, never clickable.
 */
export function SwirlBackground({
  variant = 'full',
  animated = true,
}: {
  variant?: SwirlVariant
  animated?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const moving = animated && !reducedMotion

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const style = SWIRL_STYLES[variant]
    const colors = readBandColors(style.colorStrength, style.accentStrength)

    // A fresh canvas per mount: a canvas can only be handed to a worker once.
    const canvas = document.createElement('canvas')
    box.appendChild(canvas)
    const size = () => gridSize(box.clientWidth, box.clientHeight)

    if (supportsWorker) {
      const offscreen = canvas.transferControlToOffscreen()
      const worker = new Worker(new URL('./swirl.worker.ts', import.meta.url), { type: 'module' })
      const post = (message: SwirlWorkerMessage, transfer: Transferable[] = []) =>
        worker.postMessage(message, transfer)

      post({ type: 'init', canvas: offscreen, variant, colors, animated: moving, ...size() }, [offscreen])

      const observer = new ResizeObserver(() => post({ type: 'resize', ...size() }))
      observer.observe(box)
      const onVisibility = () => post({ type: 'visible', visible: !document.hidden })
      document.addEventListener('visibilitychange', onVisibility)

      return () => {
        document.removeEventListener('visibilitychange', onVisibility)
        observer.disconnect()
        worker.terminate()
        canvas.remove()
      }
    }

    // Fallback: draw on the main thread.
    const ctx = canvas.getContext('2d')
    if (!ctx) return () => canvas.remove()
    let grid = createGrid(1, 1, style)
    let image = ctx.createImageData(1, 1)
    let pixels = new Uint32Array(image.data.buffer)
    const resize = () => {
      const { cols, rows } = size()
      if (grid.cols === cols && grid.rows === rows) return
      canvas.width = cols
      canvas.height = rows
      grid = createGrid(cols, rows, style)
      image = ctx.createImageData(cols, rows)
      pixels = new Uint32Array(image.data.buffer)
    }
    const draw = (seconds: number) => {
      renderFrame(grid, pixels, colors, seconds, style)
      ctx.putImageData(image, 0, 0)
    }
    resize()
    draw(0)
    const observer = new ResizeObserver(() => {
      resize()
      draw(performance.now() / 1000)
    })
    observer.observe(box)

    // Only Home's full swirl animates on the main thread; elsewhere a still
    // frame keeps the main thread free for typing.
    let frame = 0
    if (moving && variant === 'full') {
      let lastDraw = 0
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick)
        if (now - lastDraw < 1000 / style.fps) return
        lastDraw = now
        draw(now / 1000)
      }
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.remove()
    }
  }, [variant, moving])

  return <div ref={boxRef} className="swirl-bg" aria-hidden="true" />
}

/**
 * Reads the band colors from the design tokens as packed RGBA pixels. Each
 * color is moved `strength` of the way from --color-screen toward its token
 * (1 = the token itself), which is how the faded variant gets its soft look.
 */
function readBandColors(strength: number, accentStrength: number): Uint32Array {
  const css = getComputedStyle(document.documentElement)
  const parse = document.createElement('canvas').getContext('2d')
  const rgb = (token: string, fallback: string): [number, number, number] => {
    if (!parse) return [0, 0, 0]
    // The canvas turns any CSS color into "#rrggbb" for us.
    parse.fillStyle = fallback
    parse.fillStyle = css.getPropertyValue(token).trim() || fallback
    const hex = String(parse.fillStyle)
    return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
  }

  const screen = rgb(...BAND_TOKENS[0])
  const packed = new Uint32Array(BAND_TOKENS.length)
  BAND_TOKENS.forEach(([token, fallback], band) => {
    const target = rgb(token, fallback)
    const amount = band === 3 ? accentStrength : band === 0 ? 1 : strength
    const [r, g, b] = target.map((v, k) => Math.round(screen[k] + (v - screen[k]) * amount))
    // ImageData is RGBA in memory; as a little-endian 32-bit number that's
    // 0xAABBGGRR.
    packed[band] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
  })
  return packed
}
