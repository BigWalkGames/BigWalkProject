import { useState } from 'react'
import { NavButton } from '../../components/NavButton/NavButton'
import {
  AuthForm,
  Field,
  FormMessage,
  LinkButton,
} from '../../components/AuthForm/AuthForm'
import {
  MIN_PASSWORD_LENGTH,
  USERNAME_HINT,
  USERNAME_RULE,
  requestPasswordReset,
  signIn,
  signUp,
} from '../../hooks/auth/authActions'

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---------------------------------------------------------------------------
// Log in with username or email
// ---------------------------------------------------------------------------

export function LoginForm({
  onBack,
  onForgot,
  onSignUp,
}: {
  onBack: () => void
  onForgot: () => void
  onSignUp: () => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (busy) return
    if (!identifier.trim() || !password) {
      setError('Enter your username or email, and your password.')
      return
    }
    setBusy(true)
    setError('')
    const result = await signIn(identifier, password)
    setBusy(false)
    // On success AuthGate swaps this screen for the game automatically.
    if (result.error) setError(result.error)
  }

  return (
    <AuthForm onSubmit={() => void submit()} onEscape={onBack}>
      <h3 className="auth-form__title">Log in</h3>

      <Field
        id="login-identifier"
        label="Username or email"
        value={identifier}
        onChange={setIdentifier}
        autoComplete="username"
        autoFocus
      />
      <Field
        id="login-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <FormMessage error={error} />

      <div className="auth-form__actions">
        <NavButton hotkey="esc" onClick={onBack}>
          Back
        </NavButton>
        <NavButton hotkey="enter" type="submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </NavButton>
      </div>

      <div className="auth-form__links">
        <LinkButton onClick={onForgot}>Forgot password?</LinkButton>
        <LinkButton onClick={onSignUp}>Create an account</LinkButton>
      </div>
    </AuthForm>
  )
}

// ---------------------------------------------------------------------------
// Create a new account (for players who aren't signed in)
// ---------------------------------------------------------------------------

export function SignUpForm({
  onBack,
  onLogin,
}: {
  onBack: () => void
  onLogin: () => void
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  function validate(): string {
    if (!USERNAME_RULE.test(username))
      return `Usernames are ${USERNAME_HINT.toLowerCase()}`
    if (!EMAIL_RULE.test(email.trim())) return 'Enter a valid email address.'
    if (password.length < MIN_PASSWORD_LENGTH)
      return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`
    if (password !== confirm) return 'The passwords don’t match.'
    return ''
  }

  async function submit() {
    if (busy) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    const result = await signUp(username, email, password)
    setBusy(false)
    if (result.error) setError(result.error)
    else setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <AuthForm onSubmit={onLogin} onEscape={onBack}>
        <h3 className="auth-form__title">Check your email</h3>
        <p className="auth-form__text">
          We sent a confirmation link to <strong>{sentTo}</strong>. Click it to
          finish creating your account, then log in with your username and
          password.
        </p>
        <p className="auth-form__text">Not there? Check your spam folder.</p>
        <div className="auth-form__actions">
          <NavButton hotkey="enter" type="submit">
            Go to login
          </NavButton>
        </div>
      </AuthForm>
    )
  }

  return (
    <AuthForm onSubmit={() => void submit()} onEscape={onBack}>
      <h3 className="auth-form__title">Create account</h3>

      <Field
        id="signup-username"
        label="Username"
        value={username}
        onChange={setUsername}
        autoComplete="username"
        maxLength={20}
        hint={`${USERNAME_HINT} You'll log in with this.`}
        autoFocus
      />
      <Field
        id="signup-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        hint="Used to confirm your account and reset your password."
      />
      <Field
        id="signup-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <Field
        id="signup-confirm"
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <FormMessage error={error} />

      <div className="auth-form__actions">
        <NavButton hotkey="esc" onClick={onBack}>
          Back
        </NavButton>
        <NavButton hotkey="enter" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </NavButton>
      </div>

      <div className="auth-form__links">
        <LinkButton onClick={onLogin}>
          Already have an account? Log in
        </LinkButton>
      </div>
    </AuthForm>
  )
}

// ---------------------------------------------------------------------------
// Forgot password: send a reset link to the account's email
// ---------------------------------------------------------------------------

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit() {
    if (busy) return
    if (!EMAIL_RULE.test(email.trim())) {
      setError('Enter the email address on your account.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    const result = await requestPasswordReset(email)
    setBusy(false)
    if (result.error) setError(result.error)
    // Same message whether or not the email has an account, so this can't be used to check emails.
    else
      setNotice(
        `If ${email.trim()} has an account, a reset link is on its way. Check your spam folder too.`,
      )
  }

  return (
    <AuthForm onSubmit={() => void submit()} onEscape={onBack}>
      <h3 className="auth-form__title">Reset password</h3>
      <p className="auth-form__text">
        Enter your account’s email and we’ll send you a reset link.
      </p>

      <Field
        id="forgot-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        autoFocus
      />

      <FormMessage error={error} notice={notice} />

      <div className="auth-form__actions">
        <NavButton hotkey="esc" onClick={onBack}>
          Back
        </NavButton>
        <NavButton hotkey="enter" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send link'}
        </NavButton>
      </div>
    </AuthForm>
  )
}
