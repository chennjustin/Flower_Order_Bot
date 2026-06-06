import { useQuery } from '@tanstack/react-query'
import { fetchMyStoreOnboardingContext } from '@/api/stores'
import { useAuth } from '@/hooks/useAuth'

export const ONBOARDING_STORE_CONTEXT_QUERY_KEY = ['stores', 'me', 'onboarding-context'] as const

export function useOnboardingStoreContext() {
  const { isAuthenticated, isLoading } = useAuth()

  return useQuery({
    queryKey: ONBOARDING_STORE_CONTEXT_QUERY_KEY,
    queryFn: fetchMyStoreOnboardingContext,
    enabled: isAuthenticated && !isLoading,
  })
}
