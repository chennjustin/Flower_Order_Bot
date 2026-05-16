import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingCard from '@/components/onboarding/OnboardingCard'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const DEFAULT_NAME = '管理員'
const MAX_NAME_LENGTH = 32

export default function OnboardingNamePage() {
  const { session, updateDisplayName } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(DEFAULT_NAME)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.displayName) {
      setName(session.displayName)
    }
  }, [session?.displayName])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('請輸入顯示名稱')
      return
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`顯示名稱最多 ${MAX_NAME_LENGTH} 個字元`)
      return
    }

    try {
      updateDisplayName(trimmed)
      navigate('/onboarding/line-official', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法儲存名稱')
    }
  }

  return (
    <>
      <StepIndicator current={1} className="mb-4" />
      <OnboardingCard
        title="設定您的顯示名稱"
        description="此名稱會顯示在後台操作紀錄中，之後仍可在個人設定修改。"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-left text-sm font-medium text-[#3a3a3a]">
            顯示名稱
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
              className={cn(
                'rounded-lg border border-black/15 px-3 py-2.5 text-base font-normal',
                'outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-soft',
              )}
            />
          </label>

          {error ? (
            <p className="m-0 text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className={cn(
              'w-full rounded-xl border-none py-3 text-base font-bold text-white',
              'bg-gradient-to-r from-brand-primary to-brand-secondary',
              'transition active:scale-[0.99]',
            )}
          >
            下一步
          </button>
        </form>
      </OnboardingCard>
    </>
  )
}
