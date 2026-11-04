import { useCallback, useEffect, useRef } from 'react'

/** A typing key press, timed when it happened (not when it was applied). */
export interface QueuedKey {
  key: string
  /** Wall clock time (Date.now()). */
  at: number
  /** High resolution time (performance.now()), for latencies. */
  ts: number
}

/**
 * Listens for typing keys (one character, or Backspace) on the whole document
 * while `enabled`, and hands them to `onKeys` once per animation frame: keys
 * that land in the same frame cost one render instead of one each. Each key
 * keeps the time it was pressed, so stats are unaffected.
 *
 * Returns `flush`, which applies the queued keys right away (call it before
 * ending a test so no key pressed in time is lost).
 */
export function useFrameKeys(enabled: boolean, onKeys: (keys: QueuedKey[]) => void) {
  const queue = useRef<QueuedKey[]>([])
  const frame = useRef(0)
  const onKeysRef = useRef(onKeys)
  useEffect(() => {
    onKeysRef.current = onKeys
  })

  const flush = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    const keys = queue.current
    if (keys.length === 0) return
    queue.current = []
    onKeysRef.current(keys)
  }, [])

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      // Auto-repeat is ignored so keys still held from the menu (F+J, Q)
      // don't type into the test.
      if (event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key !== 'Backspace' && event.key.length !== 1) return
      event.preventDefault()
      queue.current.push({ key: event.key, at: Date.now(), ts: performance.now() })
      if (frame.current === 0) frame.current = requestAnimationFrame(flush)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      flush()
    }
  }, [enabled, flush])

  return flush
}
