import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authApi } from '@/api/auth'
import {
  clearSession as clearStaffSession,
  getSession as getStaffSession,
  nextMockStaffId,
  resetMockAuthStorage,
  setSession as setStaffSession,
} from '@/lib/authStorage'
import { supabase } from '@/lib/supabase'
import type { StaffSession } from '@/types/auth'
import type { LineOfficialDisplay } from '@/types/authApi'

const DEFAULT_STORE_KEY = 'demo-store'

export interface AuthContextValue {
  session: StaffSession | null
  isAuthenticated: boolean
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateDisplayName: (name: string) => StaffSession
  confirmLineOfficial: () => StaffSession
  completeOnboarding: () => StaffSession
  rejectWrongAccount: () => Promise<void>
  getLineOfficialDisplay: (storeKey: string) => LineOfficialDisplay
  /** DEV: clear mock session and staff ID counter. */
  resetMockAuth: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function createStaffSessionFromUser(user: User): StaffSession {
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    '管理員'

  const session: StaffSession = {
    staffId: nextMockStaffId(),
    storeKey: DEFAULT_STORE_KEY,
    displayName,
    onboardingStep: 'NAME',
    role: 'OWNER',
  }
  setStaffSession(session)
  return session
}

/** Load or create StaffSession when Supabase auth is present. */
function bridgeStaffSession(supabaseSession: Session | null): StaffSession | null {
  if (!supabaseSession?.access_token) {
    return null
  }

  const existing = getStaffSession()
  if (existing) {
    return existing
  }

  // TODO: replace with GET /auth/me when backend Google OAuth is ready.
  return createStaffSessionFromUser(supabaseSession.user)
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<StaffSession | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    function applySupabaseSession(supabaseSession: Session | null) {
      const authed = Boolean(supabaseSession?.access_token)
      setIsAuthenticated(authed)
      setSession(authed ? bridgeStaffSession(supabaseSession) : null)
      if (!authed) {
        clearStaffSession()
      }
    }

    supabase.auth.getSession().then(({ data: { session: supabaseSession } }) => {
      if (!mounted) return
      applySupabaseSession(supabaseSession)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, supabaseSession) => {
      if (!mounted) return
      applySupabaseSession(supabaseSession)
      if (event === 'INITIAL_SESSION') {
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
  }, [])

  const signOut = useCallback(async () => {
    authApi.logout()
    setSession(null)
    setIsAuthenticated(false)
    await supabase.auth.signOut()
  }, [])

  const updateDisplayName = useCallback((name: string) => {
    const next = authApi.updateDisplayName(name)
    setSession(next)
    return next
  }, [])

  const confirmLineOfficial = useCallback(() => {
    const next = authApi.confirmLineOfficial()
    setSession(next)
    return next
  }, [])

  const completeOnboarding = useCallback(() => {
    const next = authApi.completeOnboarding()
    setSession(next)
    return next
  }, [])

  const rejectWrongAccount = useCallback(async () => {
    authApi.rejectWrongAccount()
    setSession(null)
    setIsAuthenticated(false)
    await supabase.auth.signOut()
  }, [])

  const getLineOfficialDisplay = useCallback(
    (storeKey: string) => authApi.getLineOfficialDisplay(storeKey),
    [],
  )

  const resetMockAuth = useCallback(() => {
    resetMockAuthStorage()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated,
      isLoading,
      signInWithGoogle,
      signOut,
      updateDisplayName,
      confirmLineOfficial,
      completeOnboarding,
      rejectWrongAccount,
      getLineOfficialDisplay,
      resetMockAuth,
    }),
    [
      session,
      isAuthenticated,
      isLoading,
      signInWithGoogle,
      signOut,
      updateDisplayName,
      confirmLineOfficial,
      completeOnboarding,
      rejectWrongAccount,
      getLineOfficialDisplay,
      resetMockAuth,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
