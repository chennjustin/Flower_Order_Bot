import { api } from './client'
import type { Stats } from '@/types/domain'

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>('/stats')
  return data
}
