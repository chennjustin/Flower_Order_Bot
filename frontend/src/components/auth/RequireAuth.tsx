import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import AuthLoading from '@/components/auth/AuthLoading'
import { useAuth } from '@/hooks/useAuth'

interface RequireAuthProps {
  children: ReactNode
}

/** Redirect unauthenticated users to /login. */
export default function RequireAuth({ children }: RequireAuthProps) {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoading />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
