import { Navigate } from 'react-router-dom'
import AuthLoading from '@/components/auth/AuthLoading'
import { useAuth } from '@/hooks/useAuth'
import { getOnboardingPath } from '@/lib/onboardingPaths'

/** Sends /onboarding to the step matching the current session. */
export default function OnboardingIndexRedirect() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return <AuthLoading />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (session.onboardingStep === 'DONE') {
    return <Navigate to="/settings/order-fields" replace />
  }

  return <Navigate to={getOnboardingPath(session.onboardingStep)} replace />
}
