import type { AuthChangeEvent, AuthError } from '@supabase/supabase-js'
import { getSupabase } from '../../lib/supabase'

const supabase = getSupabase()

// Every action returns a player-friendly message, or null when it worked.
export type ActionResult = { error: string | null }

// Same rules as the database (users_username_format) and the Edge Function.
export const USERNAME_RULE = /^[A-Za-z0-9_]{3,20}$/
export const USERNAME_HINT = '3–20 letters, numbers or underscores.'
export const MIN_PASSWORD_LENGTH = 8

// Email links come back to whichever site sent them (localhost, a preview, or production).
// Each origin must be in Supabase → Authentication → URL Configuration → Redirect URLs.
const siteUrl = (path = '/') => `${window.location.origin}${path}`

// Turns Supabase Auth errors into messages a player understands.
function authMessage(
  error: AuthError,
  fallback = 'Something went wrong. Try again.',
): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.'
    case 'email_not_confirmed':
      return 'Confirm your email first. Check your inbox for the link.'
    case 'email_exists':
    case 'user_already_exists':
      return 'That email already has an account. Log in instead.'
    case 'weak_password':
      return `That password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`
    case 'same_password':
      return 'Choose a password different from your current one.'
    case 'otp_expired':
      return 'That code is wrong or has expired. Check it, or send a new one.'
    case 'email_address_invalid':
      return 'That email address isn’t valid.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a minute and try again.'
    default:
      return error.message || fallback
  }
}

// ---------------------------------------------------------------------------
// Guest
// Creates an anonymous (guest) user. Needs "Allow anonymous sign-ins" enabled.
// ---------------------------------------------------------------------------

export const signInAsGuest = () => supabase.auth.signInAnonymously()

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

// Checks if a username is available
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', {
    p_username: username,
  })
  if (error) throw error
  return data === true
}

// ---------------------------------------------------------------------------
// Log in (username OR email + password)
// ---------------------------------------------------------------------------

export async function signIn(
  identifier: string,
  password: string,
): Promise<ActionResult> {
  const id = identifier.trim()

  // Email: Supabase signs in directly.
  if (id.includes('@')) {
    const { error } = await supabase.auth.signInWithPassword({
      email: id,
      password,
    })
    return { error: error ? authMessage(error) : null }
  }

  // Username: the username-login Edge Function looks up the email on the server.
  if (!USERNAME_RULE.test(id))
    return { error: 'Incorrect username or password.' }

  let response: Response
  try {
    response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/username-login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ username: id, password }),
      },
    )
  } catch {
    return { error: 'Could not reach the server. Check your connection.' }
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    return { error: body.message ?? 'Something went wrong. Try again.' }

  // Store the session in the browser like a normal login.
  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  })
  return { error: error ? authMessage(error) : null }
}

// ---------------------------------------------------------------------------
// Sign up (new players who aren't guests)
// ---------------------------------------------------------------------------

export async function signUp(
  username: string,
  email: string,
  password: string,
): Promise<ActionResult> {
  try {
    if (!(await isUsernameAvailable(username)))
      return { error: 'That username is taken.' }
  } catch {
    return { error: 'Could not check that username. Try again.' }
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { username }, // the database trigger saves this as the username + display name
      emailRedirectTo: siteUrl('/'),
    },
  })

  if (error) {
    // The trigger hit the unique index: someone took the name a moment ago.
    if (error.message.toLowerCase().includes('database error')) {
      return { error: 'That username was just taken. Try another.' }
    }
    return { error: authMessage(error) }
  }

  // With "Confirm email" on, Supabase doesn't say an email is already used;
  // it returns a user with no identities instead.
  if (data.user && data.user.identities?.length === 0) {
    return { error: 'That email already has an account. Log in instead.' }
  }

  return { error: null } // a confirmation email is on its way
}

// ---------------------------------------------------------------------------
// Forgot / reset password
// ---------------------------------------------------------------------------

// Sends a reset link that opens /reset-password.
export async function requestPasswordReset(
  email: string,
): Promise<ActionResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: siteUrl('/reset-password'),
  })
  return { error: error ? authMessage(error) : null }
}

// Sets a new password for the signed-in player (used by the reset page).
export async function updatePassword(password: string): Promise<ActionResult> {
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error ? authMessage(error) : null }
}

// ---------------------------------------------------------------------------
// Guest → permanent account
// The user id never changes, so all matches, history and stats stay attached.
//   1. startGuestUpgrade: reserve the username + send a code to the email
//   2. verifyGuestUpgrade: check the code (the guest becomes a permanent user)
//   3. updatePassword: set the password (Supabase requires a confirmed email first)
// ---------------------------------------------------------------------------

export async function startGuestUpgrade(
  username: string,
  email: string,
): Promise<ActionResult> {
  const { error: nameError } = await supabase.rpc('set_username', {
    p_username: username,
  })
  if (nameError) {
    if (nameError.code === '23505') return { error: 'That username is taken.' }
    if (nameError.code === '22023')
      return { error: `Usernames are ${USERNAME_HINT.toLowerCase()}` }
    return { error: 'Could not save that username. Try again.' }
  }

  const { error } = await supabase.auth.updateUser(
    { email: email.trim(), data: { username } },
    { emailRedirectTo: siteUrl('/account') },
  )
  return { error: error ? authMessage(error) : null }
}

export async function verifyGuestUpgrade(
  email: string,
  code: string,
): Promise<ActionResult> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email_change',
  })
  return { error: error ? authMessage(error) : null }
}

export async function resendGuestUpgradeCode(
  email: string,
): Promise<ActionResult> {
  const { error } = await supabase.auth.resend({
    type: 'email_change',
    email: email.trim(),
  })
  return { error: error ? authMessage(error) : null }
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

// Guests: their account can't be recovered after this (cleanup deletes it after 5 days).
// Members: they can log back in with their username or email.
// Signs out on this device only.
export const signOut = () => supabase.auth.signOut({ scope: 'local' })

// used just for getting supabase reports from events for testing logs
export const onAuthEvent = (callback: (event: AuthChangeEvent) => void) => {
  const { data } = supabase.auth.onAuthStateChange((event) => callback(event))
  return () => data.subscription.unsubscribe()
}
