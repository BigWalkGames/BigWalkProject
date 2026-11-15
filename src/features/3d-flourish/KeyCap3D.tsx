import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Center, RoundedBox, Text3D, useTexture } from '@react-three/drei'
import { NearestFilter, SRGBColorSpace, type Group, type Texture } from 'three'
import keycapUrl from '../../assets/keycap.png'
import keycapPressedUrl from '../../assets/keycappressed.png'
import { FONT_URL, type Palette } from './scene'
import { createSpring, isSettled, stepSpring } from './spring'

/** Matches the 2D .keycap--lg (100px). */
const KEY_SIZE = 100
const KEY_DEPTH = 40
/** keycap.png's art fills 28 of its 32 pixels; the body sits behind that. */
const BODY_SIZE = KEY_SIZE * (28 / 32)
/** How far the key sinks when pressed, in px. */
const PRESS_DEPTH = 18
const PRESS_DROP = 6
/** Label size: a 90px CSS font (--fs-key), in typeface units. */
const LABEL_SIZE = (90 * 72) / 100

function pixelate(textures: Texture | Texture[]) {
  for (const texture of Array.isArray(textures) ? textures : [textures]) {
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.colorSpace = SRGBColorSpace
  }
}

/**
 * A 3D keycap using the keycap.png art on its face. It springs down while
 * `pressed` and pops back up on release (snaps instantly with reduced motion).
 */
export function KeyCap3D({
  label,
  pressed,
  position,
  reducedMotion,
  palette,
}: {
  label: string
  pressed: boolean
  position: [number, number, number]
  reducedMotion: boolean
  palette: Palette
}) {
  const [face, facePressed] = useTexture([keycapUrl, keycapPressedUrl], pixelate)
  const keyRef = useRef<Group>(null)
  const spring = useRef(createSpring(0))
  const invalidate = useThree((state) => state.invalidate)

  // When the canvas only redraws on demand, ask for a frame on press/release.
  useEffect(() => invalidate(), [pressed, invalidate])

  useFrame((_, dt) => {
    const key = keyRef.current
    if (!key) return
    const target = pressed ? 1 : 0
    if (reducedMotion) {
      spring.current = createSpring(target)
    } else {
      stepSpring(spring.current, target, dt, 600, 22)
      if (!isSettled(spring.current, target)) invalidate()
    }
    key.position.z = -PRESS_DEPTH * spring.current.value
    key.position.y = -PRESS_DROP * spring.current.value
  })

  return (
    <group position={position}>
      <group ref={keyRef}>
        <RoundedBox args={[BODY_SIZE, BODY_SIZE, KEY_DEPTH]} radius={8} smoothness={2}>
          <meshBasicMaterial color={palette.keySide} />
        </RoundedBox>
        <mesh position={[0, 0, KEY_DEPTH / 2 + 0.5]}>
          <planeGeometry args={[KEY_SIZE, KEY_SIZE]} />
          <meshBasicMaterial map={pressed ? facePressed : face} transparent alphaTest={0.5} />
        </mesh>
        <Center position={[0, 4, KEY_DEPTH / 2 + 2]}>
          <Text3D font={FONT_URL} size={LABEL_SIZE} height={3} curveSegments={2}>
            {label}
            <meshBasicMaterial color={pressed ? palette.keyLabelPressed : palette.keyLabel} />
          </Text3D>
        </Center>
      </group>
    </group>
  )
}
