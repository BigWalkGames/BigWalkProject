import { Suspense, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Center, Text3D } from '@react-three/drei'
import { KeyCap3D } from './KeyCap3D'
import { Logo3D } from './Logo3D'
import { DESIGN_HEIGHT, DESIGN_WIDTH, FONT_URL, readPalette, type Palette } from './scene'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import './HomeHero3D.css'

/** Vertical layout in design px (y up, 0 = middle of the canvas). */
const LOGO_BASELINE_Y = 5
const KEYS_Y = -150
/** Gap between the F and J keys, like .home__keys (67px). */
const KEY_GAP = 67
/** "+" size: a 100px CSS font (--fs-menu-primary), in typeface units. */
const PLUS_SIZE = (100 * 72) / 100

/**
 * The 3D Home hero: the B!GWALK logo above the F + J keys.
 * `fallback` (the 2D hero) shows if WebGL isn't available.
 * Lazy-load this component so three.js only downloads when Home opens.
 */
export default function HomeHero3D({
  keysDown,
  fallback,
}: {
  keysDown: ReadonlySet<string>
  fallback: ReactNode
}) {
  const reducedMotion = usePrefersReducedMotion()
  const [palette] = useState(readPalette)

  return (
    <Canvas
      className="hero3d"
      orthographic
      // A slight view from above-left, so letters and keys show their depth
      // toward the lower right, like the 2D design's drop shadow.
      camera={{ position: [-160, 220, 1000], zoom: 1, near: 1, far: 3000 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      // Idle bob animates constantly; with reduced motion, draw only on change.
      frameloop={reducedMotion ? 'demand' : 'always'}
      fallback={fallback}
      aria-hidden="true"    >
      {/* Font and textures load here; the intro starts once they're ready. */}
      <Suspense fallback={null}>
        <FitToCanvas>
          <Logo3D
            y={LOGO_BASELINE_Y}
            keysDown={keysDown}
            reducedMotion={reducedMotion}
            palette={palette}
          />
          <Keys keysDown={keysDown} reducedMotion={reducedMotion} palette={palette} />
        </FitToCanvas>
      </Suspense>
    </Canvas>
  )
}

/** Scales the DESIGN_WIDTH x DESIGN_HEIGHT layout to fit the canvas. */
function FitToCanvas({ children }: { children: ReactNode }) {
  const size = useThree((state) => state.size)
  const scale = Math.min(size.width / DESIGN_WIDTH, size.height / DESIGN_HEIGHT)
  return <group scale={scale}>{children}</group>
}

function Keys({
  keysDown,
  reducedMotion,
  palette,
}: {
  keysDown: ReadonlySet<string>
  reducedMotion: boolean
  palette: Palette
}) {
  const half = 50 + KEY_GAP + 25 // half a key + gap + half the "+"
  return (
    <group position={[0, KEYS_Y, 0]}>
      <KeyCap3D
        label="F"
        pressed={keysDown.has('f')}
        position={[-half, 0, 0]}
        reducedMotion={reducedMotion}
        palette={palette}
      />
      <Center position={[0, 0, 0]}>
        <Text3D font={FONT_URL} size={PLUS_SIZE} height={6} curveSegments={2}>
          +
          <meshBasicMaterial color={palette.keyLabel} />
        </Text3D>
      </Center>
      <KeyCap3D
        label="J"
        pressed={keysDown.has('j')}
        position={[half, 0, 0]}
        reducedMotion={reducedMotion}
        palette={palette}
      />
    </group>
  )
}
