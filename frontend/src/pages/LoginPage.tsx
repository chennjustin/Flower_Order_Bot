import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLoading from '@/components/auth/AuthLoading'
import { useAuth } from '@/hooks/useAuth'
import { getOnboardingPath } from '@/lib/onboardingPaths'
import { isSupabaseConfigured } from '@/lib/supabase'

const LOGIN_PAGE_BACKGROUND_CLASS = 'bg-[#D8EAFF]'
const LOGIN_CARD_CLASS = 'w-full max-w-md rounded-2xl bg-white px-10 py-12 shadow-lg'

export default function LoginPage() {
  const { session, isAuthenticated, isLoading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading || !isAuthenticated || !session) return

    const target =
      session.onboardingStep === 'DONE' ? '/' : getOnboardingPath(session.onboardingStep)
    navigate(target, { replace: true })
  }, [isLoading, isAuthenticated, session, navigate])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        <AuthLoading />
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center px-4 ${LOGIN_PAGE_BACKGROUND_CLASS}`}
      >
        <div className={`${LOGIN_CARD_CLASS} text-center`}>
          <h1 className="text-xl font-bold text-gray-800">無法登入</h1>
          <p className="mt-3 text-base text-gray-500">
            請在 frontend/.env.local 設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY，然後重啟前端。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 ${LOGIN_PAGE_BACKGROUND_CLASS}`}>
      <div className={LOGIN_CARD_CLASS}>
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🌸</div>
          <h1 className="text-2xl font-bold text-gray-800">花店訂單系統</h1>
          <p className="mt-2 text-base text-gray-500">請使用 Google 帳號登入</p>
        </div>

        <button
          onClick={() => void signInWithGoogle()}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-base font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          使用 Google 帳號登入
        </button>
      </div>
    </div>
  )
}
