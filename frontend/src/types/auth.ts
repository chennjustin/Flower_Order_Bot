/** Staff role aligned with backend StaffRole enum. */
export type StaffRole = 'OWNER' | 'CLERK' | 'ADMIN'

/** Onboarding progress for a single staff member. */
export type OnboardingStep = 'NAME' | 'LINE_OA' | 'DONE'

/** Authenticated staff session (mock now; same shape for future GET /auth/me). */
export interface StaffSession {
  staffId: number
  storeKey: string
  displayName: string
  onboardingStep: OnboardingStep
  role?: StaffRole
}
