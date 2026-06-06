import { useQuery } from '@tanstack/react-query'
import { fetchMyStoreOnboardingContext } from '@/api/stores'
import { useAuth } from '@/hooks/useAuth'

export function useOnboardingStoreContext() {
  const { isAuthenticated, isLoading } = useAuth()

  return useQuery({
    queryKey: ['stores', 'me', 'onboarding-context'],
    queryFn: fetchMyStoreOnboardingContext,
    enabled: isAuthenticated && !isLoading,
  })
}
