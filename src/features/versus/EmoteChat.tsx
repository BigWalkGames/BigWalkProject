import { useLayoutEffect, useRef } from 'react'
import type { Emote } from '../../net/quickMatch'
import { ProfilePicture } from '../../components/ProfilePicture/ProfilePicture'
import { opponentProfile } from '../profile/profilePicture'
import { useMyProfilePicture } from '../profile/useMyProfilePicture'
import { EMOTE_BY_ID, EMOTE_SLOTS } from './emotes'
import { useEmoteSlots } from './emoteSettings'

/**
 * The match chat (P43), styled like the "Chatroom" panel: a header, the emotes both
 * players sent, and at the bottom the emote on each arrow key. Each message shows the
 * sender's picture, with YOU / OPPONENT above the message (P32). The box keeps a fixed
 * height so a new emote never moves the words; it scrolls, kept on the newest message.
 */
export function EmoteChat({
  emotes,
  sessionId,
  active,
  closed = false,
}: {
  emotes: Emote[]
  sessionId: string | null
  /** The arrow keys send emotes right now (during the race and on the results summary). */
  active: boolean
  /** The room is gone (the opponent left or the chat timed out), so nobody can chat. */
  closed?: boolean
}) {
  const slots = useEmoteSlots()
  const myPicture = useMyProfilePicture()
  const opponent = opponentProfile()
  const logRef = useRef<HTMLUListElement>(null)

  // Stay on the newest message.
  useLayoutEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [emotes.length])

  return (
    <section className={`emote-chat${closed ? ' is-closed' : ''}`} aria-label="Chatroom">
      <h2 className="emote-chat__title">Chatroom</h2>
      <ul className="emote-chat__log" role="log" aria-live="polite" ref={logRef}>
        {emotes.length === 0 && (
          <li className="emote-chat__empty">{closed ? 'Chat closed.' : active ? 'Press an arrow key to chat.' : 'No emotes yet.'}</li>
        )}
        {emotes.map((emote) => {
          const mine = emote.from === sessionId
          return (
            <li key={emote.n} className={`emote-chat__line${mine ? ' is-mine' : ''}`}>
              <ProfilePicture pictureId={mine ? myPicture : opponent.picture} size="sm" />
              <span className="emote-chat__body">
                <span className="emote-chat__who">{mine ? 'You' : opponent.name}</span>
                <span className="emote-chat__text">{EMOTE_BY_ID[emote.id].label}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {closed && emotes.length > 0 && <p className="emote-chat__closed">Chat closed.</p>}
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
