import { api } from '@/api/client'

export interface StoreListItem {
  id: number
  name: string
  slug: string | null
}

/** List active stores for the staff store picker (no X-Store-Id required). */
export async function fetchStores(): Promise<StoreListItem[]> {
  const { data } = await api.get<StoreListItem[]>('/stores')
  return data
}
