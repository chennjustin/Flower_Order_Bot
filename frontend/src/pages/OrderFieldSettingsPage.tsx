import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import OrderFieldList from '@/components/orderFields/OrderFieldList'
import PreviewPanel from '@/components/orderFields/PreviewPanel'
import {
  settingsCancelBtnClass,
  settingsCardClass,
  settingsEditBtnClass,
  settingsSaveBtnClass,
} from '@/components/orderFields/orderFieldSettingsStyles'
import PageHeader from '@/components/layout/PageHeader'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'

export default function OrderFieldSettingsPage() {
  const { hasChanges, loadError, loading, resetDraft, save, savePending } = useOrderDisplayConfig()
  const [isEditing, setIsEditing] = useState(false)

  function handleStartEdit() {
    resetDraft()
    setIsEditing(true)
  }

  function handleCancel() {
    resetDraft()
    setIsEditing(false)
  }

  async function handleSave() {
    try {
      await save()
      setIsEditing(false)
      window.alert('已儲存訂單欄位設定')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(`儲存失敗：${message}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PageHeader title="訂單欄位設定" />
      <div className="flex justify-center px-4 pb-12 pt-[136px]">
        <div className="flex w-full max-w-[820px] flex-col items-center justify-center gap-6 lg:flex-row lg:items-stretch lg:gap-8">
          <section className={settingsCardClass}>
            <div className="flex flex-1 flex-col px-10 pt-8">
              {loadError && (
                <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {loadError}
                </div>
              )}
              <OrderFieldList isEditable={isEditing} />
            </div>
            <div className="flex justify-center gap-4 px-10 pb-8 pt-6">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className={settingsCancelBtnClass(true)}
                  >
                    <X className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                    取消
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
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className={settingsEditBtnClass()}
                >
                  <Pencil className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                  編輯
                </button>
              )}
            </div>
          </section>

          <section className={settingsCardClass}>
            <div className="flex flex-1 flex-col px-10 pt-8">
              <PreviewPanel />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
