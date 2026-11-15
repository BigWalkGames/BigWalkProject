import type { FocusEvent } from 'react'
import { playSound } from './sound'

/**
 * Menu "move" click for a button: on mouse hover, and on keyboard focus (Tab
 * key). Focus from a mouse click is skipped, so a click plays only its select
 * click. Spread onto the button; leave off disabled buttons.
 */
export const menuMoveSound = {
  onPointerEnter: () => playSound('menuMove'),
  onFocus: (event: FocusEvent<HTMLElement>) => {
    let keyboard = true
    try {
      keyboard = event.currentTarget.matches(':focus-visible')
    } catch {
      // Older browser without :focus-visible: treat as keyboard focus.
    }
    if (keyboard) playSound('menuMove')
  },
}

/** Whether a button's hotkey is Esc, so it plays the back click instead of select. */
export function isBackHotkey(hotkey: string | string[]): boolean {
  const keys = Array.isArray(hotkey) ? hotkey : [hotkey]
  return keys.some((k) => k.toLowerCase() === 'esc' || k.toLowerCase() === 'escape')
}
