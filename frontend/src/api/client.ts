import axios from 'axios'
import { getActiveStoreId } from '@/lib/activeStoreStorage'

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE,
})

// Multi-tenant staff APIs (orders, chat rooms, stats, field config).
api.interceptors.request.use(config => {
  const storeId = getActiveStoreId()
  if (storeId != null) {
    config.headers.set('X-Store-Id', String(storeId))
  }
  return config
})
