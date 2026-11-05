import type { Emote } from '../../net/quickMatch'
import { EMOTE_BY_ID, EMOTE_SLOTS } from './emotes'
import { useEmoteSlots } from './emoteSettings'

/**
 * The match chat (P43), styled like the "Chatroom" panel: a header, the emotes both
 * players sent (`YOU>` / `OPPONENT>`), and at the bottom the emote on each arrow key.
 * The box keeps a fixed height so a new emote never moves the words.
 */
export function EmoteChat({
  emotes,
  sessionId,
  racing,
}: {
  emotes: Emote[]
  sessionId: string | null
  racing: boolean
}) {
  const slots = useEmoteSlots()

  return (
    <section className="emote-chat" aria-label="Chatroom">
      <h2 className="emote-chat__title">Chatroom</h2>
      <ul className="emote-chat__log" role="log" aria-live="polite">
        {emotes.length === 0 && (
          <li className="emote-chat__empty">{racing ? 'Press an arrow key to send an emote.' : 'No emotes yet.'}</li>
        )}
        {emotes.slice(-5).map((emote) => {
          const mine = emote.from === sessionId
          return (
            <li key={emote.n} className={`emote-chat__line${mine ? ' is-mine' : ''}`}>
              <span className="emote-chat__who">{mine ? 'YOU>' : 'OPPONENT>'}</span>{' '}
              <span className="emote-chat__text">{EMOTE_BY_ID[emote.id].label}</span>
            </li>
          )
        })}
      </ul>
      <p className="emote-chat__keys">
        {EMOTE_SLOTS.map(({ slot, arrow }) => (
          <span key={slot} className="emote-chat__key">
            <kbd>{arrow}</kbd> {EMOTE_BY_ID[slots[slot]].label}
          </span>
        ))}
      </p>
    </section>
  )
}
