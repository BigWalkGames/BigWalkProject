import './StateMessage.css';

type StateMessageProps = {
  /** Big state title, for example "Finding Match..." or "Connection Lost...". */
  title: string;
  /** One line of detail under the title. */
  message?: string;
  /** A pixel icon shown above the title (for example the disconnect icon). */
  icon?: string;
  /** Makes the whole message pulse softly. Used while waiting. */
  pulse?: boolean;
  children?: React.ReactNode;
};

/**
 * The centered "state" layout from the design: an optional icon, a big title and a
 * line of detail. Used by the Matchmaking waiting screen and the connection / room
 * messages (P37).
 */
export function StateMessage({ title, message, icon, pulse, children }: StateMessageProps) {
  return (
    <section className={`state-message${pulse ? ' state-message--pulse' : ''}`} role="status">
      {icon && <img className="state-message__icon" src={icon} alt="" />}
      <h2 className="state-message__title">{title}</h2>
      {message && <p className="state-message__text">{message}</p>}
      {children}
    </section>
  );
}
