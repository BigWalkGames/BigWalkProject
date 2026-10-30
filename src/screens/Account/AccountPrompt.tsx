import { useEffect, useRef } from 'react';
import { NavButton } from '../../components/NavButton/NavButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import './AccountPrompt.css';

type AccountPromptProps = {
  onRegister: () => void;
  onCancel: () => void;
};

/** Shown to guests when they open Account: make an account (R) or cancel (C). */
export function AccountPrompt({ onRegister, onCancel }: AccountPromptProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useHotkeys({ r: onRegister, c: onCancel });

  // Move focus into the pop-up so keyboard and screen reader users start here
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  return (
    <div className="account-prompt">
      <div
        className="account-prompt__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-prompt-title"
        tabIndex={-1}
        ref={cardRef}
      >
        <h2 className="account-prompt__title" id="account-prompt-title">
          Make an account?
        </h2>
        <p className="account-prompt__text">
          Creating an account saves your matches and stats, so you can log in from any
          device.
        </p>
        <div className="account-prompt__actions">
          <NavButton hotkey="R" onClick={onRegister}>
            Register
          </NavButton>
          <NavButton hotkey="C" onClick={onCancel}>
            Cancel
          </NavButton>
        </div>
      </div>
    </div>
  );
}
