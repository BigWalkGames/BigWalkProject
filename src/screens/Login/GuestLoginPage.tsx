import './GuestLoginPage.css'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { NavButton } from '../../components/NavButton/NavButton'
import { useAuth } from '../../hooks/auth/useAuth'
import { useHotkeys } from '../../hooks/useHotkeys'
import { signInAsGuest } from '../../hooks/auth/authActions'
import { ForgotPasswordForm, LoginForm, SignUpForm } from './AuthForms'

type View = 'menu' | 'login' | 'signup' | 'forgot'

/**
 * Shown by AuthGate whenever nobody is signed in.
 * Menu: Login (L), Create account (S), Guest (G). Each opens its form in place.
 */
export default function GuestLoginPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [view, setView] = useState<View>('menu')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const show = (next: View) => {
    setView(next)
    setError('')
  }

  async function handleGuest() {
    if (busy) return
    setBusy(true)
    setError('')

    const { error } = await signInAsGuest()

    if (error) {
      setError(error.message)
    } else {
      navigate('/')
    }

    setBusy(false)
  }

  // Menu shortcuts. Off while a form is open, still checking for a saved session,
  // mid-request, or already signed in. (useHotkeys already ignores typing in text boxes.)
  useHotkeys(
    {
      l: () => show('login'),
      s: () => show('signup'),
      g: () => void handleGuest(),
    },
    { enabled: view === 'menu' && !loading && !busy && !user },
  )

  if (loading) return null

  return (
    <main className="at">
      <section className="at-card">
        <h2>WELCOME</h2>

        {view === 'menu' && (
          <>
            <div className="at-login">
              <NavButton hotkey="L" onClick={() => show('login')}>
                Login
              </NavButton>
              <NavButton hotkey="S" onClick={() => show('signup')}>
                Sign up
              </NavButton>
              <NavButton
                hotkey="G"
                onClick={() => void handleGuest()}
                disabled={busy}>
                {busy ? 'Starting…' : 'Guest'}
              </NavButton>
            </div>

            <p className="hint">
              Log in to save your scores, or continue as a guest.
            </p>
            {error && (
              <div className="at-msg err" role="alert">
                {error}
              </div>
            )}
          </>
        )}

        {view === 'login' && (
          <LoginForm
            onBack={() => show('menu')}
            onForgot={() => show('forgot')}
            onSignUp={() => show('signup')}
          />
        )}

        {view === 'signup' && (
          <SignUpForm
            onBack={() => show('menu')}
            onLogin={() => show('login')}
          />
        )}

        {view === 'forgot' && (
          <ForgotPasswordForm onBack={() => show('login')} />
        )}
      </section>
    </main>
  )
}
