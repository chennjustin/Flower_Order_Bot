import { useQuery } from '@tanstack/react-query'
import { fetchStats } from '@/api/stats'

export const STATS_QUERY_KEY = ['stats'] as const

export function useStats() {
  return useQuery({
    queryKey: STATS_QUERY_KEY,
    queryFn: fetchStats,
  })
}
