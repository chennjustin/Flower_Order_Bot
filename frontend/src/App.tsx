import { Navigate, Outlet } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar'
import { useAuth } from '@/contexts/AuthContext'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        載入中...
      </div>
    )
  }

  if (!session?.access_token) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  )
}
