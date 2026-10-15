import type { AuthChangeEvent } from "@supabase/supabase-js"
import { supabase } from "../../../utils/supabase"

export type Credentials = { email: string; password: string }

// Creates an anonymous (guest) user. Needs "Allow anonymous sign-ins" enabled.
export const signInAsGuest = () => supabase.auth.signInAnonymously()

// Turns the current guest into a permanent user. The user id stays the same.
export const upgradeGuest = (credentials: Credentials) =>
  supabase.auth.updateUser(credentials)

// Allow permanent users to sign in
export const signInWithEmail = (credentials: Credentials) =>
  supabase.auth.signInWithPassword(credentials)

// Allow users to sign up if they're not signed in as guest
export const signUpWithEmail = (credentials: Credentials) =>
  supabase.auth.signUp(credentials)

// Have to create a new guest account if you sign out as guest
// Can log in with credentials if you sign out as a permanent user
// Sign out only on local device
export const signOut = () => supabase.auth.signOut({ scope: "local" })

// used just for getting supabase reports from events for testing logs
export const onAuthEvent = (callback: (event: AuthChangeEvent) => void) => {
  const { data } = supabase.auth.onAuthStateChange((event) => callback(event))
  return () => data.subscription.unsubscribe()
}
