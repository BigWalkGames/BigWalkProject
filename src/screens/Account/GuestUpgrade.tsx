import { useState } from 'react';
import { NavButton } from '../../components/NavButton/NavButton';
import {
  AuthForm,
  Field,
  FormMessage,
  LinkButton,
} from '../../components/AuthForm/AuthForm';
import {
  MIN_PASSWORD_LENGTH,
  USERNAME_HINT,
  USERNAME_RULE,
  isUsernameAvailable,
  resendGuestUpgradeCode,
  startGuestUpgrade,
  updatePassword,
  verifyGuestUpgrade,
} from '../../hooks/auth/authActions';

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = 'details' | 'code';

/**
 * Turns the current guest into a permanent account. The user id stays the same,
 * so every match, history row and stat carries over without copying anything.
 *
 * onStarted: called once the code is sent. Verifying the code makes the player a
 * permanent user mid-flow, so Account keeps showing this form until onFinished.
 */
export function GuestUpgrade({
  onStarted,
  onCancel,
  onFinished,
}: {
  onStarted: () => void;
  onCancel: () => void;
  onFinished: (message: string) => void;
}) {
  const [stage, setStage] = useState<Stage>('details');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function validate(): string {
    if (!USERNAME_RULE.test(username))
      return `Usernames are ${USERNAME_HINT.toLowerCase()}`;
    if (!EMAIL_RULE.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD_LENGTH)
      return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (password !== confirm) return 'The passwords don’t match.';
    return '';
  }

  // Step 1: reserve the username and email a code.
  async function sendCode() {
    if (busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');

    try {
      if (!(await isUsernameAvailable(username))) {
        setBusy(false);
        setError('That username is taken.');
        return;
      }
    } catch {
      setBusy(false);
      setError('Could not check that username. Try again.');
      return;
    }

    const result = await startGuestUpgrade(username, email);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onStarted();
    setStage('code');
    setNotice(`We sent a code to ${email.trim()}. Check your spam folder too.`);
  }

  // Steps 2 + 3: check the code, then set the password.
  async function verify() {
    if (busy) return;
    if (!/^\d{6,10}$/.test(code.trim())) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');

    const verified = await verifyGuestUpgrade(email, code);
    if (verified.error) {
      setBusy(false);
      setError(verified.error);
      return;
    }

    const saved = await updatePassword(password);
    setBusy(false);
    if (saved.error) {
      // The account is permanent now (email confirmed), just without a password.
      onFinished(
        `Your account is saved, but the password couldn’t be set (${saved.error}). ` +
          'Use “Forgot password?” on the login screen to set one.',
      );
      return;
    }
    onFinished(`Account created! Log in next time as ${username}.`);
  }

  async function resend() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const result = await resendGuestUpgradeCode(email);
    setBusy(false);
    if (result.error) setError(result.error);
    else setNotice(`New code sent to ${email.trim()}.`);
  }

  if (stage === 'code') {
    return (
      <AuthForm onSubmit={() => void verify()} onEscape={onCancel}>
        <h3 className="auth-form__title">Enter your code</h3>
        <Field
          id="upgrade-code"
          label="Verification code"
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, ''))}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={10}
          autoFocus
        />
        <FormMessage error={error} notice={notice} />
        <div className="auth-form__actions">
          <NavButton hotkey="esc" onClick={onCancel} disabled={busy}>
            Cancel
          </NavButton>
          <NavButton hotkey="enter" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Confirm'}
          </NavButton>
        </div>
        <div className="auth-form__links">
          <LinkButton onClick={() => void resend()} disabled={busy}>
            Send a new code
          </LinkButton>
        </div>
      </AuthForm>
    );
  }

  return (
    <AuthForm onSubmit={() => void sendCode()}>
      <h3 className="auth-form__title">Save your progress</h3>
      <p className="auth-form__text">
        We'll email you a code to confirm your address.
      </p>

      <Field
        id="upgrade-username"
        label="Username"
        value={username}
        onChange={setUsername}
        autoComplete="username"
        maxLength={20}
        hint={`${USERNAME_HINT} You'll log in with this.`}
      />
      <Field
        id="upgrade-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        hint="We’ll send a code here to confirm it."
      />
      <Field
        id="upgrade-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <Field
        id="upgrade-confirm"
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <FormMessage error={error} />

      <div className="auth-form__actions">
        <button
          type="button"
          className="auth-button"
          onClick={onCancel}
          disabled={busy}>
          Cancel
        </button>
        <NavButton hotkey="enter" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send code'}
        </NavButton>
      </div>
    </AuthForm>
  );
}
