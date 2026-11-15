import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text3D, useFont } from '@react-three/drei'
import type { Group } from 'three'
import { createSpring, stepSpring, type Spring } from './spring'
import { FONT_URL, LETTER_SPACING, LOGO_SIZE, type Palette } from './scene'

const LETTERS = 'B!GWALK'

/** Seconds between each letter starting its pop-up. */
const INTRO_STAGGER = 0.06
/** Idle bob: height in px and speed. */
const BOB_HEIGHT = 6
const BOB_SPEED = 1.6
/** Hop when F or J is pressed: height in px, length, and wave stagger. */
const HOP_HEIGHT = 28
const HOP_DURATION = 0.28
const HOP_STAGGER = 0.035

/**
 * B!GWALK as one 3D mesh per letter, so each letter can move on its own:
 * - intro: letters pop up from below, left to right
 * - idle: a slow wave-shaped bob
 * - a key in `keysDown` newly pressed: a quick hop that ripples across
 * With `reducedMotion`, letters sit still in place.
 */
export function Logo3D({
  y,
  keysDown,
  reducedMotion,
  palette,
}: {
  y: number
  keysDown: ReadonlySet<string>
  reducedMotion: boolean
  palette: Palette
}) {
  const font = useFont(FONT_URL)
  const letterRefs = useRef<(Group | null)[]>([])
  const springs = useRef<{ y: Spring; scale: Spring }[]>([])
  const startedAt = useRef<number | null>(null)
  const hop = useRef({ keys: keysDown, at: -Infinity })

  // Letter widths and x positions from the font's advance widths. Each letter
  // pivots on its bottom center, so it grows and hops from its own middle.
  const scale = LOGO_SIZE / font.data.resolution
  const widths = [...LETTERS].map((ch) => font.data.glyphs[ch].ha * scale)
  const xs: number[] = []
  let x = 0
  for (const w of widths) {
    xs.push(x + w / 2)
    x += w + LETTER_SPACING
  }
  const offset = (x - LETTER_SPACING) / 2

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    startedAt.current ??= t
    const since = t - startedAt.current

    if (keysDown !== hop.current.keys) {
      const newlyPressed = [...keysDown].some((k) => !hop.current.keys.has(k))
      hop.current = { keys: keysDown, at: newlyPressed ? t : hop.current.at }
    }

    letterRefs.current.forEach((letter, i) => {
      if (!letter) return
      const s = (springs.current[i] ??= {
        y: createSpring(reducedMotion ? 0 : -60),
        scale: createSpring(reducedMotion ? 1 : 0),
      })

      if (reducedMotion) {
        letter.position.y = 0
        letter.scale.setScalar(1)
        return
      }

      const started = since >= i * INTRO_STAGGER
      const bob = Math.sin(t * BOB_SPEED - i * 0.6) * BOB_HEIGHT
      stepSpring(s.y, started ? bob : -60, dt)
      stepSpring(s.scale, started ? 1 : 0, dt, 320, 18)

      const hopT = (t - hop.current.at - i * HOP_STAGGER) / HOP_DURATION
      const hopY = hopT > 0 && hopT < 1 ? Math.sin(Math.PI * hopT) * HOP_HEIGHT : 0

      letter.position.y = s.y.value + hopY
      letter.scale.setScalar(Math.max(0, s.scale.value))
    })
  })

  return (
    <group position={[-offset, y, 0]}>
      {[...LETTERS].map((ch, i) => (
        <group
          key={ch + i}
          position={[xs[i], 0, 0]}
          ref={(el) => {
            letterRefs.current[i] = el
          }}
        >
          <Text3D
            font={FONT_URL}
            size={LOGO_SIZE}
            height={34}
            curveSegments={2}
            position={[-widths[i] / 2, 0, 0]}
          >
            {ch}
            <meshBasicMaterial attach="material-0" color={palette.ink} />
            <meshBasicMaterial attach="material-1" color={palette.inkSide} />
          </Text3D>
        </group>
      ))}
    </group>
  )
}
