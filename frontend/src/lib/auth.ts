import { redirect } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export async function requireAuth() {
  if (!isSupabaseConfigured) {
    throw redirect('/login')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw redirect('/login')
  }

  return null
}

export async function redirectIfAuthed() {
  if (!isSupabaseConfigured) {
    return null
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.access_token) {
    throw redirect('/')
  }

  return null
}
