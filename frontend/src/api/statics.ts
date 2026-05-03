import { api } from './client'
import type { StaticStats } from '@/types/models'

export async function fetchStaticData(): Promise<StaticStats> {
  const res = await api.get<StaticStats>('/stats')
  return res.data
}
