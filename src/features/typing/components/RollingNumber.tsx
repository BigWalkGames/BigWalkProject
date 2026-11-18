import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../3d-flourish/usePrefersReducedMotion'

/** Full spins of the first digit; each digit to the right spins once more. */
const BASE_SPINS = 1
/** Delay between digits starting, so they land left to right. */
const STAGGER_S = 0.12

/**
 * An odometer: each digit is a strip of 0-9 that spins and lands on its value,
 * left to right. Calls `onLanded` once the last digit stops (immediately with
 * reduced motion, where the number simply appears).
 * Remount it (via `key`) to roll a new value.
 */
export function RollingNumber({ value, onLanded }: { value: number; onLanded?: () => void }) {
  const reducedMotion = usePrefersReducedMotion()
  const digits = [...String(Math.max(0, Math.round(value)))].map(Number)
  const [rolling, setRolling] = useState(false)
  const landedRef = useRef(false)
  const onLandedRef = useRef(onLanded)
  useEffect(() => {
    onLandedRef.current = onLanded
  })

  const land = useCallback(() => {
    if (landedRef.current) return
    landedRef.current = true
    onLandedRef.current?.()
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      land()
      return
    }
    // Two frames: the first paints the strips at 0, the second starts the roll.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setRolling(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [reducedMotion, land])

  if (reducedMotion) return <span className="roll">{digits.join('')}</span>

  return (
    <span className="roll" aria-label={digits.join('')}>
      {digits.map((digit, i) => {
        const steps = (BASE_SPINS + i) * 10 + digit
        const isLast = i === digits.length - 1
        return (
          <span key={i} className="roll__digit" aria-hidden="true">
            <span
              className="roll__strip"
              style={{
                transform: rolling ? `translateY(-${steps}em)` : 'translateY(0)',
                transitionDelay: `${i * STAGGER_S}s`,
              }}
              onTransitionEnd={isLast ? land : undefined}
            >
              {Array.from({ length: steps + 1 }, (_, k) => (
                <span key={k}>{k % 10}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
