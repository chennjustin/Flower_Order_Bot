import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

/**
 * Placeholder for store order list visible-field settings.
 * Entering this route marks onboarding as DONE (see useEffect below).
 */
export default function OrderFieldsPage() {
  const { session, completeOnboarding } = useAuth()
  const hasCompletedRef = useRef(false)

  useEffect(() => {
    if (hasCompletedRef.current) return
    hasCompletedRef.current = true
    completeOnboarding()
  }, [completeOnboarding])

  const storeKey = session?.storeKey ?? '—'

  return (
    <>
      <PageHeader title="訂單欄位設定" />
      <div className="mx-auto max-w-[720px] px-6 pt-[160px] pb-12">
        <div className="rounded-2xl border border-black/8 bg-white p-8 shadow-sm">
          <p className="m-0 text-base leading-relaxed text-[#3a3a3a]">
            此頁將用於設定訂單列表與工單中要顯示的欄位。功能開發中，完成 onboarding
            後您可先使用其他後台功能。
          </p>
          <p className="mt-4 mb-0 text-sm text-black/55">
            之後會串接 API：
            <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              GET/PUT /stores/{'{storeKey}'}/display-fields
            </code>
            （目前店家：
            <span className="font-medium text-[#3a3a3a]"> {storeKey}</span>）
          </p>

          <Link
            to="/"
            className={cn(
              'mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3',
              'text-base font-bold text-white no-underline',
              'bg-gradient-to-r from-brand-primary to-brand-secondary',
              'transition active:scale-[0.99]',
            )}
          >
            前往首頁
          </Link>
        </div>
      </div>
    </>
  )
}
