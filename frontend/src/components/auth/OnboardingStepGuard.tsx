import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import AuthLoading from '@/components/auth/AuthLoading'
import { useAuth } from '@/hooks/useAuth'
import { getOnboardingPath } from '@/lib/onboardingPaths'
import type { OnboardingStep } from '@/types/auth'

interface OnboardingStepGuardProps {
  /** Which wizard step this route represents. */
  expectedStep: Extract<OnboardingStep, 'NAME' | 'LINE_OA'>
  children: ReactNode
}

/**
 * Keeps users on the correct onboarding step and off wizard routes after DONE.
 */
export default function OnboardingStepGuard({
  expectedStep,
  children,
}: OnboardingStepGuardProps) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return <AuthLoading />
  }

  if (!session) {
    return null
  }

  if (session.onboardingStep === 'DONE') {
    return <Navigate to={getOnboardingPath('DONE')} replace />
  }

  if (session.onboardingStep !== expectedStep) {
    return <Navigate to={getOnboardingPath(session.onboardingStep)} replace />
  }

  return children
}
