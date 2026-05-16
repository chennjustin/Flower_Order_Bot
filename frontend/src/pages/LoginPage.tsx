import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import OnboardingCard from '@/components/onboarding/OnboardingCard'
import AuthLoading from '@/components/auth/AuthLoading'
import { useAuth } from '@/hooks/useAuth'
import { getOnboardingPath } from '@/lib/onboardingPaths'
import { cn } from '@/lib/utils'

const GRADIENT_STYLE = {
  background: 'linear-gradient(160deg, #6168FC 0%, #77B5FF 55%, #e4e7ff 100%)',
} as const

export default function LoginPage() {
  const { session, isLoading, loginWithGoogleMock, resetMockAuth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showWrongAccountError = searchParams.get('error') === 'wrong_account'

  useEffect(() => {
    if (isLoading || !session) return

    const target =
      session.onboardingStep === 'DONE' ? '/' : getOnboardingPath(session.onboardingStep)
    navigate(target, { replace: true })
  }, [isLoading, session, navigate])

  function handleGoogleLogin() {
    const next = loginWithGoogleMock()
    const target =
      next.onboardingStep === 'DONE' ? '/' : getOnboardingPath(next.onboardingStep)
    navigate(target, { replace: true })
  }

  function handleResetMock() {
    resetMockAuth()
    navigate('/login', { replace: true })
  }

  if (isLoading) {
    return (
      <div
        className="flex min-h-full items-center justify-center px-4"
        style={GRADIENT_STYLE}
      >
        <AuthLoading />
      </div>
    )
  }

  if (session) {
    return (
      <div
        className="flex min-h-full items-center justify-center px-4"
        style={GRADIENT_STYLE}
      >
        <AuthLoading />
      </div>
    )
  }

  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-4 py-10"
      style={GRADIENT_STYLE}
    >
      <header className="mb-8 text-center">
        <p className="m-0 text-sm font-medium tracking-[2px] text-white/80">
          奇美花店
        </p>
        <h1 className="m-0 mt-1 text-2xl font-bold tracking-wide text-white">
          Chi-Mei Floral
        </h1>
        <p className="m-0 mt-2 text-sm text-white/75">訂單管理平台</p>
      </header>

      <OnboardingCard
        title="登入"
        description="請使用店家授權的 Google 帳號登入後台。"
      >
        {showWrongAccountError ? (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700"
            role="alert"
          >
            請確認帳號！
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleGoogleLogin}
          className={cn(
            'flex w-full items-center justify-center gap-3 rounded-xl border border-black/10',
            'bg-white px-4 py-3 text-base font-medium text-[#3a3a3a]',
            'shadow-sm transition hover:bg-gray-50 active:scale-[0.99]',
          )}
        >
          <GoogleMark />
          使用 Google 登入
        </button>

        {import.meta.env.DEV ? (
          <button
            type="button"
            onClick={handleResetMock}
            className="mt-4 w-full border-none bg-transparent text-center text-xs text-black/45 underline-offset-2 hover:underline"
          >
            [DEV] 重設 mock 登入狀態
          </button>
        ) : null}
      </OnboardingCard>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
