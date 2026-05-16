import { useState } from 'react'
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
import { cn } from '@/lib/utils'

export default function OnboardingLineOfficialPage() {
  const { session, confirmLineOfficial, rejectWrongAccount, getLineOfficialDisplay } =
    useAuth()
  const navigate = useNavigate()
  const [wrongAccountOpen, setWrongAccountOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

  if (!session) {
    return null
  }

  const lineOfficial = getLineOfficialDisplay(session.storeKey)

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
        title="確認店家 LINE 官方帳號"
        description="請比對您手機 LINE 好友列表中的官方帳號，是否與下方顯示一致（非您的 Google 登入帳號）。"
      >
        <div className="flex flex-col items-center gap-3 rounded-xl bg-brand-soft/40 px-4 py-5">
          <img
            src={lineOfficial.imageUrl}
            alt=""
            width={120}
            height={120}
            className="h-[120px] w-[120px] rounded-2xl border border-black/10 object-cover"
          />
          <p className="m-0 text-center text-lg font-bold text-[#3a3a3a]">
            {lineOfficial.displayName}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleConfirmCorrect}
            className={cn(
              'w-full rounded-xl border-none py-3 text-base font-bold text-white',
              'bg-gradient-to-r from-brand-primary to-brand-secondary',
              'transition active:scale-[0.99]',
            )}
          >
            正確，下一步
          </button>

          <button
            type="button"
            onClick={() => setWrongAccountOpen(true)}
            className={cn(
              'w-full rounded-xl border border-black/15 bg-white py-2.5 text-sm font-medium',
              'text-[#555] transition hover:bg-gray-50',
            )}
          >
            這不是我的登入帳號
          </button>

          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="w-full border-none bg-transparent py-1 text-sm text-black/50 underline-offset-2 hover:text-black/70 hover:underline"
          >
            官方帳號顯示不對（聯絡支援）
          </button>
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
                'w-full rounded-lg border-none py-2.5 text-sm font-medium text-white sm:w-auto',
                'bg-gradient-to-r from-brand-primary to-brand-secondary',
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
