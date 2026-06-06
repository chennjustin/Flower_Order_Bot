import { useMemo, useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { useCreateOrderDirect } from '@/hooks/useOrders'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import type { OrderFieldKey } from '@/types/orderDisplay'
import { cn } from '@/lib/utils'
import {
  DRAFT_SUPPORTED_KEYS,
  DateTimeRow,
  EMPTY_FORM,
  buildFieldDef,
  FormRow,
  type FieldDef,
  type FieldKey,
  type FormState,
  formStateToOrderPatch,
  isSendDatetimeMissing,
} from '@/components/messages/orderDraftForm'

const REQUIRED_KEYS: (keyof FormState)[] = [
  'item',
  'customer_name',
  'customer_phone',
  'quantity',
  'total_amount',
]

interface OrderCreatePanelProps {
  onBack: () => void
  onCreated: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export default function OrderCreatePanel({
  onBack,
  onCreated,
  onDirtyChange,
}: OrderCreatePanelProps) {
  const createOrder = useCreateOrderDirect()
  const { savedConfig } = useOrderDisplayConfig()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [attempted, setAttempted] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  const isDirty = useMemo(
    () => (Object.keys(form) as (keyof FormState)[]).some(k => form[k] !== EMPTY_FORM[k]),
    [form],
  )

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    const next = { ...form, [key]: value }
    setForm(next)
    const dirty = (Object.keys(next) as (keyof FormState)[]).some(k => next[k] !== EMPTY_FORM[k])
    onDirtyChange?.(dirty)
  }

  const visibleFields = useMemo<FieldDef[]>(() => {
    const supportedSet = new Set<OrderFieldKey>(DRAFT_SUPPORTED_KEYS)
    return [...savedConfig.fields]
      .sort((a, b) => a.order - b.order)
      .filter(f => f.visible && supportedSet.has(f.key) && f.key !== 'id' && f.key !== 'order_date')
      .map(f => {
        const base = buildFieldDef(f.key as FieldKey)
        if (f.key === 'order_status') return { ...base, editable: true, variant: 'order_status' as const }
        return base
      })
  }, [savedConfig.fields])

  function isMissing(key: FieldKey): boolean {
    if (!attempted) return false
    if (key === 'send_datetime') return isSendDatetimeMissing(form)
    if (!REQUIRED_KEYS.includes(key as keyof FormState)) return false
    return !String(form[key as keyof FormState] ?? '').trim()
  }

  function handleBack() {
    if (isDirty) {
      setShowLeaveDialog(true)
    } else {
      onBack()
    }
  }

  async function handleSave() {
    setAttempted(true)
    const hasEmpty = REQUIRED_KEYS.some(k => !String(form[k] ?? '').trim())
    if (hasEmpty || isSendDatetimeMissing(form)) return

    try {
      const patch = formStateToOrderPatch(form)
      await createOrder.mutateAsync(patch)
      onDirtyChange?.(false)
      onCreated()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`建立訂單失敗：${message}`)
    }
  }

  const isSaving = createOrder.isPending

  return (
    <aside className="relative flex h-full w-[336px] flex-shrink-0 flex-col border-l border-[#B3B3B3] bg-white">
      <header className="flex h-20 flex-shrink-0 items-center gap-2 border-b-[1.5px] border-[#e9e9e9] px-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-[#F5F6FF] hover:text-[#6168FC] active:scale-95"
          aria-label="返回"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-lg font-bold text-black font-['Noto_Sans_TC',sans-serif]">
          新增訂單
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D9D9D9] text-[#6168FC] transition hover:bg-[#C5C7FF] hover:text-white active:scale-95 disabled:opacity-60"
          aria-label="儲存訂單"
        >
          <Check className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <div className="flex flex-col gap-4">
          {visibleFields.map(field =>
            field.key === 'send_datetime' ? (
              <DateTimeRow
                key={field.key}
                label={field.label}
                date={form.send_datetime_date}
                time={form.send_datetime_time}
                onDateChange={v => setField('send_datetime_date', v)}
                onTimeChange={v => setField('send_datetime_time', v)}
                missing={isMissing('send_datetime')}
              />
            ) : (
              <FormRow
                key={field.key}
                field={field}
                isEditing={field.editable}
                form={form}
                setField={setField}
                display={null}
                missing={isMissing(field.key)}
              />
            ),
          )}
        </div>
      </div>

      <div className="flex-shrink-0 px-4 py-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-base font-bold text-white transition active:scale-95',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
            'bg-[#6168FC] hover:bg-[#4F51FF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)]',
          )}
        >
          <span>儲存訂單</span>
        </button>
      </div>

      {showLeaveDialog && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center rounded-[inherit] bg-black/20">
          <div className="w-[280px] rounded-2xl bg-white px-6 py-5 shadow-xl font-['Noto_Sans_TC',sans-serif]">
            <p className="mb-1 text-base font-bold text-black">確定要離開？</p>
            <p className="mb-5 text-sm text-black/50">尚未儲存的變更將會遺失。</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveDialog(false)}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-[#e0e3ed] text-sm font-bold text-black/60 transition hover:bg-[#F5F5F5]"
              >
                繼續編輯
              </button>
              <button
                type="button"
                onClick={() => { setShowLeaveDialog(false); onBack() }}
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white transition hover:bg-red-600"
              >
                離開
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
