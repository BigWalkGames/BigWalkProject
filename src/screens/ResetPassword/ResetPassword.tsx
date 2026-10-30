import './ResetPassword.css'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout'
import { NavButton } from '../../components/NavButton/NavButton'
import {
  AuthForm,
  Field,
  FormMessage,
} from '../../components/AuthForm/AuthForm'
import { useAuth } from '../../hooks/auth/useAuth'
import {
  MIN_PASSWORD_LENGTH,
  updatePassword,
} from '../../hooks/auth/authActions'

/**
 * Opened from the "Reset password" email. Supabase signs the player in from the
 * link, so they're already logged in here and only need to pick a new password.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit() {
    if (busy) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The passwords don’t match.')
      return
    }
    setBusy(true)
    setError('')
    const result = await updatePassword(password)
    setBusy(false)
    if (result.error) setError(result.error)
    else setDone(true)
  }

  return (
    <ScreenLayout title="New Password">
      <div className="reset">
        {isGuest ? (
          <p className="auth-form__text">
            Guest accounts don’t have a password. Open the reset link from your
            email to change a permanent account’s password.
          </p>
        ) : done ? (
          <AuthForm onSubmit={() => navigate('/', { replace: true })}>
            <h3 className="auth-form__title">Password updated</h3>
            <p className="auth-form__text">
              You’re logged in. Next time, use your new password.
            </p>
            <div className="auth-form__actions">
              <NavButton hotkey="enter" type="submit">
                Continue
              </NavButton>
            </div>
          </AuthForm>
        ) : (
          <AuthForm onSubmit={() => void submit()}>
            <h3 className="auth-form__title">Choose a new password</h3>
            <Field
              id="reset-password"
              label="New password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
              autoFocus
            />
            <Field
              id="reset-confirm"
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
            <FormMessage error={error} />
            <div className="auth-form__actions">
              <NavButton hotkey="enter" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save password'}
              </NavButton>
            </div>
          </AuthForm>
        )}
      </div>
    </ScreenLayout>
  )
}
