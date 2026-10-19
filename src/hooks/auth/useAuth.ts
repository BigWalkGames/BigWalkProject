import { createContext, useContext } from "react"
import type { Session, User } from "@supabase/supabase-js"

// three possible user states
// no session | anonymous user | permanent user
export type AuthStatus = "out" | "guest" | "member"

export type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean // true until the saved session has been checked
  status: AuthStatus
  isGuest: boolean
  isMember: boolean // signed in with a permanent (non-anonymous) account
}

// create context for auth provider functions
export const AuthContext = createContext<AuthState | null>(null)

// Reads the current auth state from AuthProvider.
// Any component that calls this re-renders automatically when the state changes.
// Throws if used outside <AuthProvider>.
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
