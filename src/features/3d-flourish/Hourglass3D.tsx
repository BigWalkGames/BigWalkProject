import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, Object3D, Vector2, type Group, type InstancedMesh } from 'three'
import { createSpring, isSettled, stepSpring, type Spring } from './spring'
import {
  BOTTOM_SLOTS,
  GRAIN_COUNT,
  GRAIN_SIZE,
  NECK,
  TOP_SLOTS,
  bulbRadius,
  createGrains,
  type Grain,
  type Vec3,
} from './hourglassSand'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import './Hourglass3D.css'

/** One grain leaves the top every this many seconds (80 grains ~ 6s). */
const DRIP_INTERVAL = 0.075
/** Pause with the top empty before the idle loop flips it over. */
const EMPTY_PAUSE = 0.8
/** Falling speed-up, in sprite pixels per second squared. */
const GRAVITY = 60
/** How quickly resting grains settle into their spots after a flip. */
const SETTLE_SPEED = 12

export interface HourglassColors {
  frame: string
  glass: string
  sand: string
}

/**
 * A 3D hourglass for the menu buttons. Sand drips from the top bulb to the
 * bottom; when the top is empty it flips over (top tumbling toward the
 * viewer) and starts again. A new `hovered` flips it right away.
 * `pressed` swaps to the dark colors, like hourglasspressed.png.
 */
export default function Hourglass3D({
  hovered,
  pressed,
  fallback,
}: {
  hovered: boolean
  pressed: boolean
  /** Shown instead of the canvas if WebGL isn't available. */
  fallback: ReactNode
}) {
  const reducedMotion = usePrefersReducedMotion()
  const [colors] = useState(readColors)
  const current = pressed ? colors.pressed : colors.normal

  return (
    <Canvas
      className="hourglass3d"
      // 30 deg field of view from 60 units away shows 32 units top to bottom,
      // the same framing as the 32px sprite.
      camera={{ fov: 30, position: [0, 0, 60], near: 1, far: 200 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      fallback={fallback}
      aria-hidden="true"
    >
      <Hourglass hovered={hovered} reducedMotion={reducedMotion} colors={current} />
    </Canvas>
  )
}

function readColors(): { normal: HourglassColors; pressed: HourglassColors } {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const light = token('--color-light', '#e8dcc8')
  const ink = token('--color-ink', '#1c1410')
  return {
    normal: { frame: light, glass: light, sand: token('--color-accent', '#d98e36') },
    pressed: { frame: ink, glass: ink, sand: ink },
  }
}

function Hourglass({
  hovered,
  reducedMotion,
  colors,
}: {
  hovered: boolean
  reducedMotion: boolean
  colors: HourglassColors
}) {
  const flipRef = useRef<Group>(null)
  const sandRef = useRef<InstancedMesh>(null)
  const invalidate = useThree((state) => state.invalidate)

  // Animation state lives in refs: it changes every frame and never needs a
  // React re-render.
  const sim = useRef({
    grains: createGrains(),
    topCount: GRAIN_COUNT,
    bottomCount: 0,
    dripClock: 0,
    emptyFor: 0,
    flip: null as Spring | null,
    wasHovered: hovered,
  })
  const dummy = useMemo(() => new Object3D(), [])

  // Draw the starting pile once (also the only frame with reduced motion).
  useLayoutEffect(() => {
    writeGrainMatrices(sandRef.current, sim.current.grains, dummy)
    invalidate()
  }, [dummy, invalidate])

  useFrame((_, dt) => {
    const s = sim.current
    const flipGroup = flipRef.current
    if (reducedMotion || !flipGroup) return

    const hoverStarted = hovered && !s.wasHovered
    s.wasHovered = hovered

    if (!s.flip) {
      if (hoverStarted || s.emptyFor >= EMPTY_PAUSE) {
        startFlip(s)
      } else {
        drip(s, dt)
      }
    }

    if (s.flip) {
      stepSpring(s.flip, Math.PI, dt, 90, 11)
      flipGroup.rotation.x = s.flip.value
      if (isSettled(s.flip, Math.PI)) {
        // Upside down looks identical to upright, so reset the rotation and
        // swap which pile is "top". Grains are mirrored to match the rotation
        // and then settle into their new spots.
        flipGroup.rotation.x = 0
        s.flip = null
        finishFlip(s)
      }
    }

    settle(s.grains, dt)
    writeGrainMatrices(sandRef.current, s.grains, dummy)
  })

  return (
    // A slight turn so the frame's depth shows even when standing still.
    <group rotation={[0, 0.35, 0]}>
      <group ref={flipRef}>
        <Frame color={colors.frame} />
        <Glass color={colors.glass} />
        <instancedMesh ref={sandRef} args={[undefined, undefined, GRAIN_COUNT]}>
          <boxGeometry args={[GRAIN_SIZE, GRAIN_SIZE, GRAIN_SIZE]} />
          <meshBasicMaterial color={colors.sand} />
        </instancedMesh>
      </group>
    </group>
  )
}

type Sim = {
  grains: Grain[]
  topCount: number
  bottomCount: number
  dripClock: number
  emptyFor: number
  flip: Spring | null
}

/** Releases grains through the neck and lets falling ones drop. */
function drip(s: Sim, dt: number) {
  s.dripClock += dt
  while (s.dripClock >= DRIP_INTERVAL && s.topCount > 0) {
    s.dripClock -= DRIP_INTERVAL
    // The grain on the pile's surface leaves; it reappears at the neck.
    const surface = s.topCount - 1
    const grain = s.grains.find((g) => g.state === 'top' && g.slot === surface)
    s.topCount -= 1
    if (!grain) continue
    grain.state = 'falling'
    grain.slot = s.bottomCount
    s.bottomCount += 1
    grain.pos = [NECK[0] + (Math.random() - 0.5) * 0.6, NECK[1], NECK[2]]
    grain.velocityY = 0
  }

  let falling = 0
  for (const grain of s.grains) {
    if (grain.state !== 'falling') continue
    falling += 1
    grain.velocityY -= GRAVITY * Math.min(dt, 1 / 30)
    grain.pos[1] += grain.velocityY * Math.min(dt, 1 / 30)
    const rest = BOTTOM_SLOTS[grain.slot]
    if (grain.pos[1] <= rest[1]) {
      grain.state = 'bottom'
      grain.pos = [...rest]
    }
  }

  s.emptyFor = s.topCount === 0 && falling === 0 ? s.emptyFor + dt : 0
}

function startFlip(s: Sim) {
  // Grains mid-air land instantly so the flip starts from two clean piles.
  for (const grain of s.grains) {
    if (grain.state === 'falling') {
      grain.state = 'bottom'
      grain.pos = [...BOTTOM_SLOTS[grain.slot]]
    }
  }
  s.flip = createSpring(0)
  s.emptyFor = 0
  s.dripClock = 0
}

function finishFlip(s: Sim) {
  const wasTop = s.grains.filter((g) => g.state === 'top')
  const wasBottom = s.grains.filter((g) => g.state === 'bottom')
  for (const grain of s.grains) {
    // A half turn around x maps (x, y, z) to (x, -y, -z).
    grain.pos = [grain.pos[0], -grain.pos[1], -grain.pos[2]]
  }
  // Fill the lowest new spots first with the grains that are nearest to them.
  wasBottom.sort((a, b) => a.pos[1] - b.pos[1])
  wasTop.sort((a, b) => a.pos[1] - b.pos[1])
  wasBottom.forEach((grain, i) => {
    grain.state = 'top'
    grain.slot = i
  })
  wasTop.forEach((grain, i) => {
    grain.state = 'bottom'
    grain.slot = i
  })
  s.topCount = wasBottom.length
  s.bottomCount = wasTop.length
}

/** Eases resting grains toward their spots (after a flip they start mirrored). */
function settle(grains: Grain[], dt: number) {
  const k = Math.min(1, dt * SETTLE_SPEED)
  for (const grain of grains) {
    if (grain.state === 'falling') continue
    const target = grain.state === 'top' ? TOP_SLOTS[grain.slot] : BOTTOM_SLOTS[grain.slot]
    grain.pos = [
      grain.pos[0] + (target[0] - grain.pos[0]) * k,
      grain.pos[1] + (target[1] - grain.pos[1]) * k,
      grain.pos[2] + (target[2] - grain.pos[2]) * k,
    ] as Vec3
  }
}

function writeGrainMatrices(mesh: InstancedMesh | null, grains: Grain[], dummy: Object3D) {
  if (!mesh) return
  grains.forEach((grain, i) => {
    dummy.position.set(grain.pos[0], grain.pos[1], grain.pos[2])
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
}

/** Caps and four posts, sized like the sprite (14 wide, 22 tall). */
function Frame({ color }: { color: string }) {
  return (
    <group>
      {[9.7, -9.7].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[14, 2.6, 7]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      {[
        [-6, -2.6],
        [6, -2.6],
        [-6, 2.6],
        [6, 2.6],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0, z]}>
          <cylinderGeometry args={[0.5, 0.5, 17, 6]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

/** Two bulbs meeting at a narrow neck: a lathe of the bulb radius. */
function Glass({ color }: { color: string }) {
  const points = useMemo(() => {
    const pts: Vector2[] = []
    for (let y = -8.4; y <= 8.4001; y += 0.4) pts.push(new Vector2(bulbRadius(y) + 0.3, y))
    return pts
  }, [])
  return (
    <mesh>
      <latheGeometry args={[points, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.18} side={DoubleSide} depthWrite={false} />
    </mesh>
  )
}
