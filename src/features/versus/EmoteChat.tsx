import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { CHAT_MAX_LENGTH, type Emote } from '../../net/quickMatch'
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
  otherName,
  canType = false,
  onSend,
}: {
  emotes: Emote[]
  sessionId: string | null
  /** The arrow keys send emotes right now (in the lobby, during the race and on the results summary). */
  active: boolean
  /** The room is gone (the opponent left or the chat timed out), so nobody can chat. */
  closed?: boolean
  /** What to call the other player. Defaults to their profile name ("Friend" in a Custom Game lobby). */
  otherName?: string
  /** Show the typing box (lobby and results, never during the race). Press T to start typing. */
  canType?: boolean
  /** Sends what was typed. Returns false when it was not sent (too fast), so the text stays. */
  onSend?: (text: string) => boolean
}) {
  const slots = useEmoteSlots()
  const myPicture = useMyProfilePicture()
  const opponent = opponentProfile()
  const logRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  // T starts typing. (The letter keys are free here: nobody is typing the words.)
  useEffect(() => {
    if (!canType) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 't' && event.key !== 'T') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      event.preventDefault() // so the "t" does not land in the box
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canType])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    if (onSend?.(draft)) {
      setDraft('')
      inputRef.current?.blur() // so R, Q and Esc work again
    }
  }

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
                <span className="emote-chat__who">{mine ? 'You' : (otherName ?? opponent.name)}</span>
                <span className="emote-chat__text">{emote.text ?? EMOTE_BY_ID[emote.id].label}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {closed && emotes.length > 0 && <p className="emote-chat__closed">Chat closed.</p>}
      {canType && (
        <form className="emote-chat__form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="emote-chat__input"
            type="text"
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            placeholder="Press T to type"
            aria-label="Type a message. Press Enter to send, Escape to stop typing."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                inputRef.current?.blur()
              }
            }}
          />
        </form>
      )}
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
