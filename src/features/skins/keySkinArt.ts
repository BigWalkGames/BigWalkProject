import sheetUrl from '../../assets/skins/key-textures.png'
import frameUrl from '../../assets/keyframe.png'
import { keySkinIndex, type KeySkinId } from './keySkins'

/**
 * Keyboard skins are textures tiled across the key's shape, under one shading
 * overlay (keyframe.png: clear face, translucent black edge and bevel). The
 * designer only edits key-textures.png: a grid of TEXTURE_CELL x TEXTURE_CELL
 * cells, one per skin, each a seamless tile at keycap pixel scale. See
 * skinnedKey.css for the 2D keys; the 3D keycap uses the composited `face`.
 */
export const TEXTURE_CELL = 16
/** keyframe.png's size; the key's shape starts TEXTURE_INSET in. */
const FRAME_SIZE = 32
const TEXTURE_INSET = 2

type RGB = [number, number, number]

export type KeyLabelTone = 'dark' | 'light'

/** The label colors, matching --color-frame and --color-light in index.css. */
const LABEL_RGB: Record<KeyLabelTone, RGB> = {
  dark: [0x3a, 0x2c, 0x22],
  light: [0xe8, 0xdc, 0xc8],
}

export interface KeySkinArt {
  /** One texture cell as a data URL, tiled inside the 2D keycaps. */
  texture: string
  /** The texture under keyframe.png, for the 3D keycap's face. */
  face: string
  /** Which label color reads best on the texture. */
  label: KeyLabelTone
  /** The 3D keycap's sides: the texture's average color, shaded like the edge. */
  side: string
}

/** WCAG relative luminance of an sRGB color, 0 (black) to 1 (white). */
function luminance([r, g, b]: RGB): number {
  const linear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Average color of the opaque pixels in RGBA data, or null if there are none. */
function averageColor(rgba: ArrayLike<number>): RGB | null {
  const sum: RGB = [0, 0, 0]
  let count = 0
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue
    sum[0] += rgba[i]
    sum[1] += rgba[i + 1]
    sum[2] += rgba[i + 2]
    count++
  }
  return count === 0 ? null : [sum[0] / count, sum[1] / count, sum[2] / count]
}

/** The label tone with more contrast against the average color of RGBA pixels. */
export function labelTone(rgba: ArrayLike<number>): KeyLabelTone {
  const average = averageColor(rgba)
  if (!average) return 'dark'
  const l = luminance(average)
  return contrast(l, luminance(LABEL_RGB.dark)) >= contrast(l, luminance(LABEL_RGB.light))
    ? 'dark'
    : 'light'
}

/**
 * The average color of RGBA pixels darkened by `shade` (0 to 1), the way the
 * translucent black edge in keyframe.png darkens the texture, as #rrggbb.
 */
export function shadedAverage(rgba: ArrayLike<number>, shade: number): string {
  const average = averageColor(rgba) ?? [0, 0, 0]
  return `#${average
    .map((c) => Math.round(c * (1 - shade)).toString(16).padStart(2, '0'))
    .join('')}`
}

/** A skin's art; the first cell (Classic) if the sheet has no cell for it. */
export function artForSkin(cells: KeySkinArt[], id: KeySkinId): KeySkinArt {
  return cells[keySkinIndex(id)] ?? cells[0]
}

/** CSS variables that skin every keycap inside the element they're set on. */
export function keySkinVars(art: KeySkinArt): Record<string, string> {
  return {
    '--skin-texture': `url("${art.texture}")`,
    '--skin-label': art.label === 'dark' ? 'var(--color-frame)' : 'var(--color-light)',
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  return { canvas, ctx }
}

async function load(): Promise<KeySkinArt[]> {
  const [sheet, frame] = await Promise.all([loadImage(sheetUrl), loadImage(frameUrl)])

  // How dark keyframe.png's edge is, read from the middle of its top edge, so
  // the 3D sides follow the art if the designer changes it.
  const probe = canvas2d(FRAME_SIZE, FRAME_SIZE)
  probe.ctx.drawImage(frame, 0, 0)
  const edgeShade = probe.ctx.getImageData(FRAME_SIZE / 2, TEXTURE_INSET, 1, 1).data[3] / 255

  const columns = Math.floor(sheet.naturalWidth / TEXTURE_CELL)
  const rows = Math.floor(sheet.naturalHeight / TEXTURE_CELL)
  const cells: KeySkinArt[] = []

  for (let i = 0; i < columns * rows; i++) {
    const tile = canvas2d(TEXTURE_CELL, TEXTURE_CELL)
    tile.ctx.drawImage(
      sheet,
      (i % columns) * TEXTURE_CELL,
      Math.floor(i / columns) * TEXTURE_CELL,
      TEXTURE_CELL,
      TEXTURE_CELL,
      0,
      0,
      TEXTURE_CELL,
      TEXTURE_CELL,
    )
    const pixels = tile.ctx.getImageData(0, 0, TEXTURE_CELL, TEXTURE_CELL).data

    // Same layering as skinnedKey.css: the texture in the key's shape (a
    // square with a 1-pixel notch at each corner), the shading on top.
    const face = canvas2d(FRAME_SIZE, FRAME_SIZE)
    const pattern = face.ctx.createPattern(tile.canvas, 'repeat')
    if (!pattern) throw new Error('Canvas patterns are not available')
    const near = TEXTURE_INSET
    const far = FRAME_SIZE - TEXTURE_INSET - 1
    face.ctx.translate(near, near)
    face.ctx.fillStyle = pattern
    face.ctx.fillRect(0, 0, far - near + 1, far - near + 1)
    face.ctx.resetTransform()
    for (const [x, y] of [[near, near], [far, near], [near, far], [far, far]]) {
      face.ctx.clearRect(x, y, 1, 1)
    }
    face.ctx.drawImage(frame, 0, 0)

    cells.push({
      texture: tile.canvas.toDataURL(),
      face: face.canvas.toDataURL(),
      label: labelTone(pixels),
      side: shadedAverage(pixels, edgeShade),
    })
  }
  return cells
}

let loading: Promise<KeySkinArt[]> | undefined

/**
 * Every cell of the texture sheet, in sheet order (index with keySkinIndex).
 * Loaded once and shared; a failed load is retried on the next call.
 */
export function loadKeySkinArt(): Promise<KeySkinArt[]> {
  loading ??= load().catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}
