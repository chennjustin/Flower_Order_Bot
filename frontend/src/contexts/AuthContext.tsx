import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi, isMockAuthEnabled } from '@/api/auth'
import { resetMockAuthStorage } from '@/lib/authStorage'
import type { StaffSession } from '@/types/auth'
import type { LineOfficialDisplay } from '@/types/authApi'

export interface AuthContextValue {
  session: StaffSession | null
  isLoading: boolean
  loginWithGoogleMock: () => StaffSession
  logout: () => void
  updateDisplayName: (name: string) => StaffSession
  confirmLineOfficial: () => StaffSession
  completeOnboarding: () => StaffSession
  rejectWrongAccount: () => void
  getLineOfficialDisplay: (storeKey: string) => LineOfficialDisplay
  /** DEV: clear mock session and staff ID counter. */
  resetMockAuth: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

async function loadInitialSession(): Promise<StaffSession | null> {
  if (isMockAuthEnabled()) {
    return authApi.getSession()
  }
  // TODO: GET /auth/me when backend Google OAuth is ready.
  return authApi.getSession()
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<StaffSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const initial = await loadInitialSession()
        if (!cancelled) {
          setSession(initial)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const loginWithGoogleMock = useCallback(() => {
    const next = authApi.loginWithGoogleMock()
    setSession(next)
    return next
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setSession(null)
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

  const rejectWrongAccount = useCallback(() => {
    authApi.rejectWrongAccount()
    setSession(null)
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
      isLoading,
      loginWithGoogleMock,
      logout,
      updateDisplayName,
      confirmLineOfficial,
      completeOnboarding,
      rejectWrongAccount,
      getLineOfficialDisplay,
      resetMockAuth,
    }),
    [
      session,
      isLoading,
      loginWithGoogleMock,
      logout,
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
