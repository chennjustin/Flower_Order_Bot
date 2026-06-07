import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import OrderFieldList from '@/components/orderFields/OrderFieldList'
import PreviewPanel from '@/components/orderFields/PreviewPanel'
import {
  settingsCancelBtnClass,
  settingsCardClass,
  settingsSaveBtnClass,
} from '@/components/orderFields/orderFieldSettingsStyles'
import PageHeader from '@/components/layout/PageHeader'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'

export default function OrderFieldSettingsPage() {
  const { hasChanges, loadError, loading, resetDraft, save, savePending } = useOrderDisplayConfig()
  const [showSavedDialog, setShowSavedDialog] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isOnboarding = searchParams.get('from') === 'onboarding'

  const blocker = useBlocker(hasChanges && !savePending)

  useEffect(() => {
    resetDraft()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    try {
      await save()
      if (isOnboarding) {
        navigate('/', { replace: true })
      } else {
        setShowSavedDialog(true)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(`儲存失敗：${message}`)
    }
  }

  function handleCancel() {
    resetDraft()
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PageHeader title="訂單欄位設定" />
      <div className="flex justify-center px-4 pb-12 pt-[160px]">
        {isOnboarding && (
          <div className="mb-6 w-full max-w-[820px] rounded-xl bg-[#D8EAFF] px-5 py-4 font-['Noto_Sans_TC',sans-serif]">
            <p className="m-0 font-bold">歡迎來到 Flourish 🎉</p>
            <p className="m-0 mt-1 text-black/60">你可以在這裡設定訂單中要顯示的欄位，設定完成後儲存即可進入後台。</p>
          </div>
        )}
        <div className="flex w-full max-w-[820px] flex-col items-center justify-center gap-6 lg:flex-row lg:items-stretch lg:gap-8">
          <section className={settingsCardClass}>
            <div className="flex flex-1 flex-col px-10 pt-8">
              {loadError && (
                <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {loadError}
                </div>
              )}
              <OrderFieldList isEditable />
            </div>
            <div className="flex justify-center gap-4 px-10 pb-8 pt-6">
              <button
                type="button"
                onClick={handleCancel}
                disabled={!hasChanges || loading}
                className={settingsCancelBtnClass(hasChanges && !loading)}
              >
                <X className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                取消變更
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || loading || savePending}
                className={settingsSaveBtnClass(hasChanges && !loading && !savePending)}
              >
                <Check className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                {savePending ? '儲存中...' : '儲存'}
              </button>
            </div>
          </section>

          <div className="hidden lg:block lg:w-full lg:max-w-[370px]">
            <section className={settingsCardClass}>
              <div className="flex flex-1 flex-col px-10 pt-8">
                <PreviewPanel />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* 儲存成功 dialog */}
      {showSavedDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/30">
          <div className="w-[280px] rounded-2xl bg-white px-6 py-5 shadow-xl font-['Noto_Sans_TC',sans-serif]">
            <p className="mb-1 text-base font-bold text-black">已儲存</p>
            <p className="mb-5 text-sm text-black/50">訂單欄位設定已成功儲存。</p>
            <button
              type="button"
              onClick={() => setShowSavedDialog(false)}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-[#6168FC] text-sm font-bold text-white transition hover:bg-[#4E55E0]"
            >
              確認
            </button>
          </div>
        </div>
      )}

      {/* 離開前提醒 dialog */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/30">
          <div className="w-[280px] rounded-2xl bg-white px-6 py-5 shadow-xl font-['Noto_Sans_TC',sans-serif]">
            <p className="mb-1 text-base font-bold text-black">確定要離開？</p>
            <p className="mb-5 text-sm text-black/50">尚未儲存的變更將會遺失。</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-[#e0e3ed] text-sm font-bold text-black/60 transition hover:bg-[#F5F5F5]"
              >
                繼續編輯
              </button>
              <button
                type="button"
                onClick={() => { resetDraft(); blocker.proceed() }}
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white transition hover:bg-red-600"
              >
                離開
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
