import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import OrderFieldList from '@/components/orderFields/OrderFieldList'
import PreviewPanel from '@/components/orderFields/PreviewPanel'
import PageHeader from '@/components/layout/PageHeader'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import { cn } from '@/lib/utils'

export default function OrderFieldSettingsPage() {
  const { hasChanges, resetDraft, save } = useOrderDisplayConfig()
  const [isEditing, setIsEditing] = useState(false)

  function handleStartEdit() {
    resetDraft()
    setIsEditing(true)
  }

  function handleCancel() {
    resetDraft()
    setIsEditing(false)
  }

  function handleSave() {
    save()
    setIsEditing(false)
    window.alert('已儲存訂單欄位設定')
  }

  return (
    <>
      <PageHeader title="訂單欄位設定" />
      <div className="mx-auto max-w-[1280px] px-4 pt-[160px] pb-12 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          <section
            className={cn(
              'flex flex-col rounded-2xl border border-[#e0e3ed] bg-white p-6',
              'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
            )}
          >
            <div className="flex-1">
              <OrderFieldList isEditable={isEditing} />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#e9e9e9] pt-5">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-bold transition',
                      "font-['Noto_Sans_TC',sans-serif]",
                      'cursor-pointer bg-[#FCE8E8] text-[#AE1914] hover:opacity-90',
                    )}
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white transition',
                      "font-['Noto_Sans_TC',sans-serif]",
                      hasChanges
                        ? 'cursor-pointer bg-[#6168FC] hover:bg-[#4F51FF]'
                        : 'cursor-not-allowed bg-[#C5C7FF]',
                    )}
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    儲存
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white transition',
                    "font-['Noto_Sans_TC',sans-serif]",
                    'cursor-pointer bg-[#6168FC] hover:bg-[#4F51FF]',
                  )}
                >
                  <Pencil className="h-4 w-4" strokeWidth={2.5} />
                  編輯
                </button>
              )}
            </div>
          </section>

          <section
            className={cn(
              'flex flex-col rounded-2xl border border-[#e0e3ed] bg-white p-6',
              'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
            )}
          >
            <PreviewPanel />
          </section>
        </div>
      </div>
    </>
  )
}
