import { getMockLineOfficialDisplay } from '@/config/mockLineOfficial'
import {
  clearSession,
  getSession,
  nextMockStaffId,
  setSession,
} from '@/lib/authStorage'
import type { StaffSession } from '@/types/auth'
import type { LineOfficialDisplay } from '@/types/authApi'

const DEFAULT_DISPLAY_NAME = '管理員'
const DEFAULT_STORE_KEY = 'demo-store'

/** Auth operations; swap mock implementation for HTTP client when backend is ready. */
export interface AuthApi {
  getSession(): StaffSession | null
  loginWithGoogleMock(): StaffSession
  updateDisplayName(name: string): StaffSession
  confirmLineOfficial(): StaffSession
  completeOnboarding(): StaffSession
  rejectWrongAccount(): void
  logout(): void
  getLineOfficialDisplay(storeKey: string): LineOfficialDisplay
}

function requireSession(): StaffSession {
  const session = getSession()
  if (!session) {
    throw new Error('No active session')
  }
  return session
}

function saveSession(patch: Partial<StaffSession>): StaffSession {
  const current = requireSession()
  const next: StaffSession = { ...current, ...patch }
  setSession(next)
  return next
}

const mockAuthApi: AuthApi = {
  getSession,

  loginWithGoogleMock(): StaffSession {
    const session: StaffSession = {
      staffId: nextMockStaffId(),
      storeKey: DEFAULT_STORE_KEY,
      displayName: DEFAULT_DISPLAY_NAME,
      onboardingStep: 'NAME',
      role: 'OWNER',
    }
    setSession(session)
    return session
  },

  updateDisplayName(name: string): StaffSession {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Display name cannot be empty')
    }
    if (trimmed.length > 32) {
      throw new Error('Display name must be at most 32 characters')
    }
    return saveSession({
      displayName: trimmed,
      onboardingStep: 'LINE_OA',
    })
  },

  confirmLineOfficial(): StaffSession {
    // Step stays LINE_OA until OrderFieldsPage calls completeOnboarding.
    return requireSession()
  },

  completeOnboarding(): StaffSession {
    return saveSession({ onboardingStep: 'DONE' })
  },

  rejectWrongAccount(): void {
    clearSession()
  },

  logout(): void {
    clearSession()
  },

  getLineOfficialDisplay(storeKey: string): LineOfficialDisplay {
    return getMockLineOfficialDisplay(storeKey)
  },
}

/** True when VITE_USE_MOCK_AUTH is unset or not the string "false". */
export function isMockAuthEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCK_AUTH !== 'false'
}

/** Active auth API (mock for now). */
export const authApi: AuthApi = mockAuthApi
