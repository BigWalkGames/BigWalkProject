import { SIZE_REFERENCE_FONT, findFont, fontStylesheetUrl, type FontOption } from './fonts'

/**
 * The text fonts are measured with to compare their widths. Ordinary sentences
 * (mostly lowercase, with spaces, a few capitals and digits) so the match
 * holds for real menu and typing text, and every letter appears at least once.
 */
const SAMPLE = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. Level 10, 250 WPM'

/** One @font-face rule from a font's stylesheet. */
interface FaceRule {
  src: string
  descriptors: FontFaceDescriptors
}

/**
 * How much to scale a font so `SAMPLE` takes as much room as it does in the
 * reference font. 1 if either width is unusable.
 */
export function widthScale(referenceWidth: number, width: number): number {
  return referenceWidth > 0 && width > 0 ? referenceWidth / width : 1
}

/** Rewrites relative url(...) paths in a stylesheet to absolute ones, against the stylesheet's own URL. */
export function absoluteUrls(css: string, stylesheetUrl: string): string {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (_match, _quote, path: string) =>
    `url("${new URL(path, stylesheetUrl).href}")`,
  )
}

const rulesCache = new Map<string, Promise<FaceRule[]>>()

/** Downloads a font's stylesheet once and reads its @font-face rules. */
function readFaceRules(font: FontOption): Promise<FaceRule[]> {
  let rules = rulesCache.get(font.name)
  if (!rules) {
    const url = fontStylesheetUrl(font)
    rules = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} for ${url}`)
        return response.text()
      })
      .then((css) => {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(absoluteUrls(css, url))
        return [...sheet.cssRules]
          .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
          .map(({ style }) => ({
            src: style.getPropertyValue('src'),
            descriptors: {
              style: style.getPropertyValue('font-style') || 'normal',
              weight: style.getPropertyValue('font-weight') || 'normal',
              unicodeRange: style.getPropertyValue('unicode-range') || 'U+0-10FFFF',
              display: 'block',
            },
          }))
      })
    rulesCache.set(font.name, rules)
    rules.catch(() => rulesCache.delete(font.name)) // let a later pick try again
  }
  return rules
}

/** Registers the faces under `family`. Files download only when text needs them. */
function addFaces(family: string, rules: FaceRule[], sizeAdjust = '100%'): FontFace[] {
  return rules.map(({ src, descriptors }) => {
    // Browsers support size-adjust; TypeScript's DOM types don't list it yet.
    const scaled: FontFaceDescriptors & { sizeAdjust: string } = { ...descriptors, sizeAdjust }
    const face = new FontFace(family, src, scaled)
    document.fonts.add(face)
    return face
  })
}

/** Width of `SAMPLE` at 100px, using a temporary unscaled copy of the faces. */
async function measureWidth(rules: FaceRule[]): Promise<number> {
  const family = `measure-${crypto.randomUUID()}`
  const faces = addFaces(family, rules)
  try {
    await document.fonts.load(`100px "${family}"`, SAMPLE)
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return 0
    context.font = `100px "${family}"`
    return context.measureText(SAMPLE).width
  } finally {
    for (const face of faces) document.fonts.delete(face)
  }
}

/**
 * The scale that makes `font` as wide as the reference font (Jersey 10), the
 * font the app's sizes were designed for. 1 for the reference font itself.
 */
async function fontScale(font: FontOption, rules: FaceRule[]): Promise<number> {
  if (font.name === SIZE_REFERENCE_FONT) return 1
  const reference = findFont(SIZE_REFERENCE_FONT)!
  const [referenceWidth, width] = await Promise.all([
    readFaceRules(reference).then(measureWidth),
    measureWidth(rules),
  ])
  return widthScale(referenceWidth, width)
}

const loaded = new Map<string, Promise<void>>()

/**
 * Registers `font` on the page, scaled with size-adjust so it takes about as
 * much room as Jersey 10 at any font size, and waits for it to be ready. Never
 * rejects: if the font can't load, text shows in its fallback family.
 */
export function loadFont(font: FontOption): Promise<void> {
  let ready = loaded.get(font.name)
  if (!ready) {
    ready = (async () => {
      const rules = await readFaceRules(font)
      const scale = await fontScale(font, rules)
      addFaces(font.name, rules, `${(scale * 100).toFixed(2)}%`)
      await document.fonts.load(`100px "${font.name}"`, SAMPLE)
    })().catch((error: unknown) => {
      loaded.delete(font.name) // let a later pick try again
      console.warn(`Font "${font.name}" could not load; using ${font.fallback}.`, error)
    })
    loaded.set(font.name, ready)
  }
  return ready
}
