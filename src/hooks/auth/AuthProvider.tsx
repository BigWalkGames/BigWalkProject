import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { getSupabase } from '../../lib/supabase'
import { AuthContext } from './useAuth'
import type { AuthState } from './useAuth'
import { useNavigate } from 'react-router'

const supabase = getSupabase()

/**
 * Keeps one shared copy of the Supabase session for the whole app.
 * onAuthStateChange fires INITIAL_SESSION on subscribe, so it also covers
 * restoring a saved session on page load.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null) // current session
  const [loading, setLoading] = useState(true)

  // Kept in a ref so auth subscription is created only once.
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  })

  // Subscribe to Supabase's auth event
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)

      if (event === 'PASSWORD_RECOVERY') {
        navigateRef.current('/reset-password', { replace: true })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Build object that is shared between components
  // it is recomputed if session or loading changes
  // so components that read it dont re-render for unrelated reasons
  const value = useMemo<AuthState>(() => {
    const user = session?.user ?? null
    const isGuest = !!user?.is_anonymous
    const isMember = !!user && !isGuest
    const status = !user ? 'out' : isGuest ? 'guest' : 'member'
    return { session, user, loading, status, isGuest, isMember }
  }, [session, loading])

  // the object build is accessable throughout the app
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
