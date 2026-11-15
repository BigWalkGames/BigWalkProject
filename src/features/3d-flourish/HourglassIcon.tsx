import { lazy, Suspense, type ReactNode } from 'react'
import { Hero3DBoundary } from './Hero3DBoundary'

// three.js is downloaded only when a screen with the hourglass opens (and is
// shared with the Home hero, so it's usually cached already).
const Hourglass3D = lazy(() => import('./Hourglass3D'))

/**
 * The 3D hourglass for MenuButton's `iconScene`. Shows `fallback` (the 2D
 * PNGs) while three.js loads, or if WebGL isn't available.
 */
export function HourglassIcon({
  hovered,
  pressed,
  fallback,
}: {
  hovered: boolean
  pressed: boolean
  fallback: ReactNode
}) {
  return (
    <Hero3DBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Hourglass3D hovered={hovered} pressed={pressed} fallback={fallback} />
      </Suspense>
    </Hero3DBoundary>
  )
}
