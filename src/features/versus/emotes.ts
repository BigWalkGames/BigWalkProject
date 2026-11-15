/**
 * The emotes (P43). The server accepts only these ids (EMOTE_IDS in the server's
 * MatchRoom.ts, keep the two lists the same). The words are only shown here, so a label
 * can be changed freely. There is no free text: every player picks from this list, and
 * chooses which four go on the arrow keys (Settings, Emotes).
 */
export const EMOTE_LIBRARY = [
  { id: 'gg', label: 'GG!' },
  { id: 'nice', label: 'Nice one!' },
  { id: 'wow', label: 'Wow!' },
  { id: 'oops', label: 'Oops!' },
  { id: 'gl', label: 'Good luck!' },
  { id: 'hf', label: 'Have fun!' },
  { id: 'ez', label: 'GG too ezzz' },
  { id: 'close', label: 'So close!' },
  { id: 'fast', label: 'Fast hands!' },
  { id: 'lol', label: 'LOL' },
  { id: 'sorry', label: 'Sorry!' },
  { id: 'thanks', label: 'Thanks!' },
  { id: 'again', label: 'Again?' },
  { id: 'ouch', label: 'Ouch!' },
  { id: 'focus', label: 'Locked in' },
  { id: 'hurry', label: 'Hurry up!' },
] as const

export type EmoteId = (typeof EMOTE_LIBRARY)[number]['id']

export const EMOTE_BY_ID = Object.fromEntries(EMOTE_LIBRARY.map((emote) => [emote.id, emote])) as Record<
  EmoteId,
  (typeof EMOTE_LIBRARY)[number]
>

export const isEmoteId = (value: unknown): value is EmoteId =>
  typeof value === 'string' && Object.hasOwn(EMOTE_BY_ID, value)

/** The four arrow keys that send emotes. */
export type EmoteSlot = 'up' | 'left' | 'right' | 'down'

export const EMOTE_SLOTS: { slot: EmoteSlot; key: string; arrow: string; name: string }[] = [
  { slot: 'up', key: 'ArrowUp', arrow: '↑', name: 'Up' },
  { slot: 'left', key: 'ArrowLeft', arrow: '←', name: 'Left' },
  { slot: 'right', key: 'ArrowRight', arrow: '→', name: 'Right' },
  { slot: 'down', key: 'ArrowDown', arrow: '↓', name: 'Down' },
]

/** What each arrow key sends until the player changes it. */
export const DEFAULT_EMOTE_SLOTS: Record<EmoteSlot, EmoteId> = {
  up: 'gg',
  left: 'nice',
  right: 'wow',
  down: 'oops',
}
