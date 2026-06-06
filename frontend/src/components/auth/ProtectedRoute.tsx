import { Navigate, Outlet } from 'react-router-dom'
import AuthLoading from '@/components/auth/AuthLoading'
import { useAuth } from '@/hooks/useAuth'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <AuthLoading />
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <Outlet />
}
