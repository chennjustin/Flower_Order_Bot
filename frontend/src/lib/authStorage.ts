import type { StaffSession } from '@/types/auth'

/** localStorage key for the authenticated staff session. */
export const AUTH_SESSION_KEY = 'flower_auth_session'

/** Counter for generating unique mock staff IDs across logins. */
const MOCK_STAFF_ID_COUNTER_KEY = 'flower_auth_mock_staff_counter'

function isStaffSession(value: unknown): value is StaffSession {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.staffId === 'number' &&
    typeof s.storeKey === 'string' &&
    typeof s.displayName === 'string' &&
    (s.onboardingStep === 'NAME' ||
      s.onboardingStep === 'LINE_OA' ||
      s.onboardingStep === 'DONE')
  )
}

/** Read the current session from localStorage, or null if missing/invalid. */
export function getSession(): StaffSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isStaffSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Persist the session to localStorage. */
export function setSession(session: StaffSession): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

/** Remove the session from localStorage. */
export function clearSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY)
}

/** Allocate the next mock staff ID (persists across page reloads). */
export function nextMockStaffId(): number {
  const raw = localStorage.getItem(MOCK_STAFF_ID_COUNTER_KEY)
  const current = raw ? Number.parseInt(raw, 10) : 0
  const next = Number.isFinite(current) ? current + 1 : 1
  localStorage.setItem(MOCK_STAFF_ID_COUNTER_KEY, String(next))
  return next
}

/** DEV helper: clear session and staff ID counter for a fresh onboarding run. */
export function resetMockAuthStorage(): void {
  clearSession()
  localStorage.removeItem(MOCK_STAFF_ID_COUNTER_KEY)
}
