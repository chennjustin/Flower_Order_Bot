import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '@/api/auth'
import { fetchMyStore } from '@/api/stores'
import {
  clearSession as clearStaffSession,
  getSession as getStaffSession,
  nextMockStaffId,
  resetMockAuthStorage,
  setSession as setStaffSession,
} from '@/lib/authStorage'
import { supabase } from '@/lib/supabase'
import type { StaffSession } from '@/types/auth'

type SupabaseSession = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
type Session = NonNullable<SupabaseSession>
type User = Session['user']
import type { LineOfficialDisplay } from '@/types/authApi'

const DEFAULT_STORE_KEY = 'demo-store'

export interface AuthContextValue {
  session: StaffSession | null
  avatarUrl: string | null
  isAuthenticated: boolean
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateDisplayName: (name: string) => StaffSession
  completeStoreNameStep: () => StaffSession
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
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined

  const session: StaffSession = {
    staffId: nextMockStaffId(),
    storeKey: DEFAULT_STORE_KEY,
    displayName,
    avatarUrl,
    onboardingStep: 'LINE_OA',
    role: 'OWNER',
  }
  setStaffSession(session)
  return session
}

/** Load or create StaffSession when Supabase auth is present. */
async function bridgeStaffSession(supabaseSession: Session | null): Promise<StaffSession | null> {
  if (!supabaseSession?.access_token) {
    return null
  }

  try {
    const store = await fetchMyStore()
    const existing = getStaffSession()
    const displayName =
      (supabaseSession.user.user_metadata?.full_name as string | undefined) ??
      supabaseSession.user.email ??
      '管理員'
    const avatarUrl = supabaseSession.user.user_metadata?.avatar_url as string | undefined

    const session: StaffSession = {
      staffId: existing?.staffId ?? nextMockStaffId(),
      storeKey: String(store.id),
      displayName: existing?.displayName ?? displayName,
      avatarUrl: existing?.avatarUrl ?? avatarUrl,
      onboardingStep: store.onboarding_done ? 'DONE' : 'LINE_OA',
      role: 'OWNER',
    }
    setStaffSession(session)
    return session
  } catch (err) {
    // 後端尚未就緒時 fallback 到 localStorage
    const existing = getStaffSession()
    if (existing) return existing
    return createStaffSessionFromUser(supabaseSession.user)
  }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<StaffSession | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function applySupabaseSession(supabaseSession: Session | null) {
      const authed = Boolean(supabaseSession?.access_token)
      setIsAuthenticated(authed)
      setAvatarUrl(
        authed ? (supabaseSession?.user.user_metadata?.avatar_url as string | undefined) ?? null : null
      )
      if (authed) {
        const staffSession = await bridgeStaffSession(supabaseSession)
        if (mounted) setSession(staffSession)
      } else {
        clearStaffSession()
        if (mounted) setSession(null)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, supabaseSession) => {
      if (!mounted) return
      void applySupabaseSession(supabaseSession).then(() => {
        if (mounted && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
          setIsLoading(false)
        }
      })
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

  const completeStoreNameStep = useCallback(() => {
    const next = authApi.completeStoreNameStep()
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
      avatarUrl,
      isAuthenticated,
      isLoading,
      signInWithGoogle,
      signOut,
      updateDisplayName,
      completeStoreNameStep,
      confirmLineOfficial,
      completeOnboarding,
      rejectWrongAccount,
      getLineOfficialDisplay,
      resetMockAuth,
    }),
    [
      session,
      avatarUrl,
      isAuthenticated,
      isLoading,
      signInWithGoogle,
      signOut,
      updateDisplayName,
      completeStoreNameStep,
      confirmLineOfficial,
      completeOnboarding,
      rejectWrongAccount,
      getLineOfficialDisplay,
      resetMockAuth,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
