import axios from 'axios'
import { supabase } from '@/lib/supabase'

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE,
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const hadAuth = Boolean(error.config?.headers?.Authorization)
    const onLogin = window.location.pathname === '/login'

    // Only sign out when an authenticated request was rejected (avoids reload loop on /login).
    if (status === 401 && hadAuth && !onLogin) {
      await supabase.auth.signOut()
      window.location.replace('/login')
    }
    return Promise.reject(error)
  },
)
