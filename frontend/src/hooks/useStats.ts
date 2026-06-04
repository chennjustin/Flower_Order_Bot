import { useQuery } from '@tanstack/react-query'
import { fetchStats } from '@/api/stats'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { statsQueryKey } from '@/lib/storeQueryKeys'

/** @deprecated Use statsQueryKey(storeId) from storeQueryKeys. */
export const STATS_QUERY_KEY = ['stats'] as const

export function useStats() {
  const { storeId, enabled } = useStoreQueryGate()
  return useQuery({
    queryKey: storeId != null ? statsQueryKey(storeId) : ['stats', 'pending'],
    queryFn: fetchStats,
    enabled,
  })
}
