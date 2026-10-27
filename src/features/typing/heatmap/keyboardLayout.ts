/**
 * One key on the heatmap keyboard.
 * - `char`: the character the key types, matching TestResult.perKey keys
 *   (lowercase, ' ' for space). Omitted for blank modifier-position keys.
 * - `span`: how many grid columns the key takes (default 1).
 */
export interface KeySpec {
  id: string
  label: string
  char?: string
  span?: number
}

/** Every row is 11 columns wide, so the keyboard lines up as a grid. */
export const KEYBOARD_COLUMNS = 11

const key = (char: string): KeySpec => ({ id: char, label: char, char })
const blank = (id: string): KeySpec => ({ id, label: '' })

export const KEYBOARD_ROWS: KeySpec[][] = [
  [blank('esc'), ...Array.from('1234567890', key)],
  [...Array.from('qwertyuiop', key), blank('bksp')],
  [...Array.from("asdfghjkl;'", key)],
  [blank('lshift'), ...Array.from('zxcvbnm,.', key), blank('rshift')],
  [
    blank('lctrl'),
    blank('lmeta'),
    blank('lalt'),
    { id: 'space', label: 'space', char: ' ', span: 5 },
    blank('ralt'),
    blank('rmeta'),
    blank('rctrl'),
  ],
]
