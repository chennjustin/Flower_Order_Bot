import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { completeStoreOnboarding, updateMyStoreName, type StoreOnboardingContext } from '@/api/stores'
import OnboardingCard from '@/components/onboarding/OnboardingCard'
import StepIndicator from '@/components/onboarding/StepIndicator'
import {
  ONBOARDING_STORE_CONTEXT_QUERY_KEY,
  useOnboardingStoreContext,
} from '@/hooks/useOnboardingStoreContext'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const MAX_STORE_NAME_LENGTH = 32

export default function OnboardingNamePage() {
  const { completeStoreNameStep } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: onboardingContext } = useOnboardingStoreContext()
  const [storeName, setStoreName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (onboardingContext?.storeName) {
      setStoreName(onboardingContext.storeName)
    }
  }, [onboardingContext?.storeName])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmed = storeName.trim()
    if (!trimmed) {
      setError('請輸入店家名稱')
      return
    }
    if (trimmed.length > MAX_STORE_NAME_LENGTH) {
      setError(`店家名稱最多 ${MAX_STORE_NAME_LENGTH} 個字元`)
      return
    }

    try {
      const savedName = await updateMyStoreName(trimmed)
      queryClient.setQueryData(
        ONBOARDING_STORE_CONTEXT_QUERY_KEY,
        (prev: StoreOnboardingContext | undefined) =>
          prev ? { ...prev, storeName: savedName } : prev,
      )
      await completeStoreOnboarding()
      completeStoreNameStep()
      navigate('/settings/order-fields?from=onboarding', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法儲存店家名稱')
    }
  }

  return (
    <>
      <StepIndicator current={2} className="mb-4" />
      <OnboardingCard title="設定店家名稱">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-left text-sm font-medium text-[#3a3a3a]">
            店家名稱
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={MAX_STORE_NAME_LENGTH}
              autoComplete="organization"
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
              'w-full rounded-xl border-none bg-[#D8EAFF] py-3 text-base font-bold text-[#3a3a3a]',
              'transition active:scale-[0.99]',
            )}
          >
            進入後台
          </button>
        </form>
      </OnboardingCard>
    </>
  )
}
