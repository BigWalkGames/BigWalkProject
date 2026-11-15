import { backspace, getCurrentLetter, typeChar, type Board } from '../typing/models/Board'
import { playSound, type SoundName } from './sound'

/**
 * Picks the right click for each typing key the moment it's pressed. Typing
 * applies keys once per frame, so the real board can be a few keys behind;
 * this keeps its own copy of the board and runs the same typeChar / backspace
 * the game uses, so right, wrong, space and Backspace are known straight away.
 * Call reset() with each new board (a new test or race).
 */
export function createTypingSoundTracker(board: Board | null = null) {
  let current = board

  /** The sound for this key, or null when the game ignores the key. Advances the copy. */
  function soundFor(key: string): SoundName | null {
    if (!current) return null
    if (key === 'Backspace') {
      const next = backspace(current)
      if (next === current) return null
      current = next
      return 'backspace'
    }
    // Same as the game: typing is case-insensitive.
    const typed = key.toLowerCase()
    const expected = getCurrentLetter(current)?.char
    const next = typeChar(current, typed)
    if (expected === undefined || next === current) return null
    current = next
    if (typed !== expected) return 'wrong'
    return typed === ' ' ? 'space' : 'key'
  }

  return {
    reset(next: Board | null) {
      current = next
    },
    soundFor,
    /** Plays the sound for this key (if any). */
    press(key: string) {
      const sound = soundFor(key)
      if (sound) playSound(sound)
    },
  }
}

export type TypingSoundTracker = ReturnType<typeof createTypingSoundTracker>
