import { api } from '@/api/client'

export interface StoreListItem {
  id: number
  name: string
  slug: string | null
}

/** OAuth-bound store for the logged-in owner. */
export async function fetchMyStore(): Promise<StoreListItem> {
  const { data } = await api.get<StoreListItem>('/stores/me')
  return data
}
