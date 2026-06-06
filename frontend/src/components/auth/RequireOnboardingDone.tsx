import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import AuthLoading from '@/components/auth/AuthLoading'
import { useAuth } from '@/hooks/useAuth'
import { getOnboardingPath } from '@/lib/onboardingPaths'

interface RequireOnboardingDoneProps {
  children: ReactNode
}

/**
 * Blocks main app routes until onboarding is DONE.
 * Use inside RequireAuth on dashboard, orders, messages, stats.
 */
export default function RequireOnboardingDone({ children }: RequireOnboardingDoneProps) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return <AuthLoading />
  }

  if (!session) {
    return null
  }

  if (session.onboardingStep !== 'DONE') {
    return <Navigate to={getOnboardingPath(session.onboardingStep)} replace />
  }

  return children
}
