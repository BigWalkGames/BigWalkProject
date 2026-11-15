import { useEffect } from 'react'
import { sendEmote } from '../../net/quickMatch'
import { EMOTE_SLOTS } from './emotes'
import { getEmoteSlots } from './emoteSettings'

/**
 * P43: the arrow keys send emotes while `enabled` (the race is on). Which emote each
 * arrow sends is the player's own choice (Settings, Emotes).
 *
 * This is separate from the typing keys (useFrameKeys), which only look at single
 * characters and Backspace. So an arrow key never reaches the board: it does not move
 * the cursor and does not count as a keystroke. It is also stopped from scrolling the page.
 */
export function useEmoteKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const slot = EMOTE_SLOTS.find((candidate) => candidate.key === event.key)
      if (!slot) return
      event.preventDefault()
      if (event.repeat) return // holding the key sends one emote, not a stream
      sendEmote(getEmoteSlots()[slot.slot])
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
