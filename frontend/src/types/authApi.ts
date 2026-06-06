import type { OnboardingStep, StaffRole, StaffSession } from '@/types/auth'

/**
 * Future: GET /auth/me
 * Returns the current authenticated staff session.
 */
export type AuthMeResponse = StaffSession

/**
 * Future: PATCH /auth/me/onboarding
 * Body for onboarding step transitions.
 */
export type OnboardingPatchBody =
  | { step: 'name'; name: string }
  | { step: 'line_oa_confirmed' }
  | { step: 'complete' }
  | { step: 'line_oa_rejected'; reason: 'wrong_google_account' | 'oa_display_mismatch' }

/**
 * Future: PATCH /auth/me/onboarding response
 */
export interface OnboardingPatchResponse {
  onboardingStep: OnboardingStep
  displayName?: string
}

/**
 * Future: GET /stores/{storeKey}/line-official-display
 * LINE Official Account info shown during onboarding Step 2.
 */
export interface LineOfficialDisplay {
  displayName: string
  imageUrl: string
}

/**
 * Future: POST /auth/logout
 */
export type LogoutResponse = void

/**
 * Future: staff creation / invite metadata (for reference when wiring Google OAuth).
 */
export interface StaffInviteMetadata {
  storeKey: string
  role: StaffRole
  email?: string
}
