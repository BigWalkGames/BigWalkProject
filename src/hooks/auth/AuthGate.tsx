import type { ReactNode } from "react"
import { useAuth } from "./useAuth"

/**
 * Shows `children` only when someone is signed in (guest or permanent).
 * Otherwise shows `fallback`, e.g. your login screen.
 * Note: this hides UI only. Protect real data with Supabase Row Level Security.
 */
export default function AuthGate({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) return null // still checking for a saved session
  return <>{user ? children : fallback}</>
}
