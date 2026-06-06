import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingCard from '@/components/onboarding/OnboardingCard'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { SUPPORT_CONTACT } from '@/config/support'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useOnboardingStoreContext } from '@/hooks/useOnboardingStoreContext'
import { formatLineBasicId } from '@/lib/formatLineBasicId'
import { cn } from '@/lib/utils'

interface LineOfficialInfoFieldProps {
  label: string
  children: ReactNode
}

/** Labeled row for store / LINE OA identity fields (label left, value right). */
function LineOfficialInfoField({ label, children }: LineOfficialInfoFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/6 py-3 last:border-b-0">
      <span className="shrink-0 text-sm font-medium text-black/50">{label}</span>
      <div className="min-w-0 text-right text-sm font-semibold text-[#3a3a3a]">{children}</div>
    </div>
  )
}

interface LineOfficialAvatarProps {
  imageUrl: string | null | undefined
  displayName: string
}

/** LINE OA avatar with image or initials fallback. */
function LineOfficialAvatar({ imageUrl, displayName }: LineOfficialAvatarProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || 'L'

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={80}
        height={80}
        className="h-20 w-20 rounded-2xl border border-black/10 object-cover shadow-sm"
      />
    )
  }

  return (
    <div
      aria-hidden
      className={cn(
        'flex h-20 w-20 items-center justify-center rounded-2xl border border-black/10',
        'bg-brand-soft text-xl font-bold text-brand-primary-dark shadow-sm',
      )}
    >
      {initial}
    </div>
  )
}

export default function OnboardingLineOfficialPage() {
  const { session, confirmLineOfficial, rejectWrongAccount } = useAuth()
  const { data: onboardingContext, isLoading } = useOnboardingStoreContext()
  const navigate = useNavigate()
  const [wrongAccountOpen, setWrongAccountOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

  if (!session) {
    return null
  }

  const lineOfficial = onboardingContext?.lineOfficial
  const storeName = onboardingContext?.storeName ?? '—'
  const lineOfficialDisplayName = lineOfficial?.displayName?.trim() || '—'
  const lineOfficialImageUrl = lineOfficial?.imageUrl
  const formattedBasicId = formatLineBasicId(lineOfficial?.basicId)
  const hasBoundLineOfficial = Boolean(formattedBasicId)

  const cardDescription = isLoading
    ? '正在查詢與您帳號綁定的 LINE 官方帳號…'
    : hasBoundLineOfficial
      ? '請確認下方顯示的 LINE 官方帳號是否為您的店家帳號。'
      : '請確認您使用的是店家授權的 Google 帳號登入。'

  function handleConfirmCorrect() {
    confirmLineOfficial()
    navigate('/settings/order-fields', { replace: true })
  }

  function handleRejectWrongAccount() {
    rejectWrongAccount()
    navigate('/login?error=wrong_account', { replace: true })
  }

  return (
    <>
      <StepIndicator current={2} className="mb-4" />
      <OnboardingCard
        title="確認綁定的 LINE 官方帳號"
        description={cardDescription}
      >
        <div className="overflow-hidden rounded-xl border border-black/8 bg-gradient-to-b from-brand-soft/35 to-white">
          {isLoading ? (
            <div className="px-5 py-4" aria-busy="true">
              <div className="mb-4 flex justify-center">
                <div className="h-20 w-20 animate-pulse rounded-2xl bg-black/10" />
              </div>
              <div className="divide-y divide-black/6">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center justify-between gap-4 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-black/10" />
                    <div className="h-4 w-32 animate-pulse rounded bg-black/10" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-4">
              <div className="mb-4 flex justify-center">
                <LineOfficialAvatar
                  imageUrl={lineOfficialImageUrl}
                  displayName={lineOfficialDisplayName}
                />
              </div>

              <div>
                <LineOfficialInfoField label="店家名稱">{storeName}</LineOfficialInfoField>

                <LineOfficialInfoField label="LINE 官方帳號名稱">
                  {lineOfficialDisplayName}
                </LineOfficialInfoField>

                <LineOfficialInfoField label="LINE 官方帳號 ID">
                  {hasBoundLineOfficial ? (
                    <span className="font-mono">{formattedBasicId}</span>
                  ) : (
                    <span className="font-normal text-amber-800">找不到綁定的 LINE 官方帳號</span>
                  )}
                </LineOfficialInfoField>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {hasBoundLineOfficial ? (
            <button
              type="button"
              onClick={handleConfirmCorrect}
              disabled={isLoading}
              className={cn(
                'w-full rounded-xl border-none bg-[#D8EAFF] py-3 text-base font-bold text-[#3a3a3a]',
                'transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              正確，進入後台
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setWrongAccountOpen(true)}
            disabled={isLoading}
            className={cn(
              'w-full rounded-xl border border-black/15 bg-white py-2.5 text-sm font-medium',
              'text-[#555] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            這不是我的登入帳號
          </button>

          {hasBoundLineOfficial ? (
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="w-full border-none bg-transparent py-1 text-sm text-black/50 underline-offset-2 hover:text-black/70 hover:underline"
            >
              官方帳號顯示不對（聯絡支援）
            </button>
          ) : null}
        </div>
      </OnboardingCard>

      <Dialog open={wrongAccountOpen} onOpenChange={setWrongAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重新登入</DialogTitle>
            <DialogDescription>
              將登出目前帳號。請改用店家授權的 Google 帳號重新登入。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setWrongAccountOpen(false)}
              className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-medium text-[#555]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleRejectWrongAccount}
              className="rounded-lg border-none bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              登出並重新登入
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{SUPPORT_CONTACT.title}</DialogTitle>
            <DialogDescription>{SUPPORT_CONTACT.description}</DialogDescription>
          </DialogHeader>
          <ul className="m-0 list-none space-y-2 p-0 text-sm text-[#3a3a3a]">
            <li>
              <span className="text-black/50">Email：</span>
              <a href={`mailto:${SUPPORT_CONTACT.email}`} className="text-brand-primary-dark">
                {SUPPORT_CONTACT.email}
              </a>
            </li>
            <li>
              <span className="text-black/50">LINE ID：</span>
              {SUPPORT_CONTACT.lineId}
            </li>
            <li>
              <span className="text-black/50">服務時間：</span>
              {SUPPORT_CONTACT.hours}
            </li>
          </ul>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setSupportOpen(false)}
              className={cn(
                'w-full rounded-lg border-none bg-[#D8EAFF] py-2.5 text-sm font-medium text-[#3a3a3a] sm:min-w-[136px] sm:w-auto',
              )}
            >
              我知道了
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
