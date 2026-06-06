import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Pencil, Plus, X, Check } from 'lucide-react'
import {
  getVisibleOrderFormFields,
  orderFormTitle,
  ORDER_FORM_FIELD_UI,
  type OrderFormMode,
} from '@/config/orderFormFields'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import { formatOrderFormFieldValue } from '@/lib/orderFieldPresentation'
import type { Order } from '@/types/domain'
import type { ShipmentMethod, PaymentStatus, OrderStatus } from '@/types/enums'
import { cn } from '@/lib/utils'
import {
  EMPTY_FORM,
  formStateFromOrder,
  formStateToOrderPatch,
  formStateToOrderPatchForOrder,
  isOrderFormDirty,
  isSendDatetimeMissing,
  type FormState,
} from '@/components/messages/orderDraftForm'
import {
  ORDER_STATUS_OPTIONS,
  normalizeOrderStatus,
  orderStatusBadgeClasses,
  orderStatusLabel,
} from '@/utils/orderStatus'

interface OrderFormCardProps {
  mode: OrderFormMode
  order?: Order | null
  className?: string
  onClose?: () => void
  /** Called with the patch when saving (edit mode) or creating (create mode). */
  onSave?: (patch: ReturnType<typeof formStateToOrderPatch>, form: FormState) => Promise<void>
  /** Called whenever the dirty state changes so parents can track unsaved state. */
  onDirtyChange?: (dirty: boolean) => void
}

const labelClass =
  "py-1 text-base font-bold leading-[140%] text-black/[0.87] font-['Noto_Sans_TC',sans-serif]"
const valueClass =
  "text-base font-bold leading-[140%] text-black/60 font-['Noto_Sans_TC',sans-serif]"
const inputClass =
  "w-full h-[30px] rounded-lg border border-[#E0E0E0] bg-white px-2 py-1 text-base font-bold text-black/60 outline-none transition focus:border-[#6168FC] focus:shadow-[0_0_0_2px_#e4e7ff] font-['Noto_Sans_TC',sans-serif]"
const missingInputClass =
  "border-red-400 bg-red-50 placeholder:text-red-400 focus:border-red-400 focus:shadow-[0_0_0_2px_rgba(220,53,69,0.15)]"

const REQUIRED_KEYS: (keyof FormState)[] = ['item', 'customer_name', 'customer_phone', 'quantity', 'total_amount']

export default function OrderFormCard({
  mode,
  order,
  className,
  onClose,
  onSave,
  onDirtyChange,
}: OrderFormCardProps) {
  const { savedConfig } = useOrderDisplayConfig()
  const isCreate = mode === 'create'
  const isEdit = mode === 'edit'
  const isEditing = isCreate || isEdit
  const title = orderFormTitle(mode)

  const [form, setForm] = useState<FormState>(() =>
    order ? formStateFromOrder(order) : EMPTY_FORM,
  )
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const isDirty = useMemo(
    () => isCreate
      ? (Object.keys(form) as (keyof FormState)[]).some(k => form[k] !== EMPTY_FORM[k])
      : order ? isOrderFormDirty(form, order) : false,
    [form, order, isCreate],
  )

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Re-sync form when the loaded order changes (e.g. after a successful edit save).
  useEffect(() => {
    if (isEdit && order) {
      setForm(formStateFromOrder(order))
      setAttempted(false)
    }
  }, [order, isEdit])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function isMissing(key: keyof FormState | 'send_datetime'): boolean {
    if (!attempted || !isEditing) return false
    if (key === 'send_datetime') return isSendDatetimeMissing(form)
    if (!REQUIRED_KEYS.includes(key)) return false
    return !String(form[key] ?? '').trim()
  }

  function handleCloseClick() {
    if (isDirty) {
      setShowLeaveConfirm(true)
    } else {
      onClose?.()
    }
  }

  async function handleSave() {
    setAttempted(true)
    if (REQUIRED_KEYS.some(k => !String(form[k] ?? '').trim())) return
    if (isSendDatetimeMissing(form)) return
    setSaving(true)
    try {
      const patch = isEdit && order
        ? formStateToOrderPatchForOrder(form, order)
        : formStateToOrderPatch(form)
      await onSave?.(patch, form)
      if (isCreate) {
        // Clear the form so isDirty does not re-trigger the page leave guard.
        setForm(EMPTY_FORM)
        setAttempted(false)
        onDirtyChange?.(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const formFields = useMemo(() => getVisibleOrderFormFields(savedConfig), [savedConfig])

  return (
    <div
      className={cn(
        'flex w-[496px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] bg-white',
        'border-r border-[#B3B3B3] shadow-[0_4px_4px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      <header className="relative flex h-20 shrink-0 items-center border-b border-black/[0.38] px-10">
        <h2 className="text-2xl font-bold leading-[125%] tracking-[0.1em] text-[#6168FC] font-['Noto_Sans_TC',sans-serif]">
          {title}
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={handleCloseClick}
            aria-label="關閉"
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-sm p-1 text-black/50 transition hover:text-black/80"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="flex max-h-[min(442px,calc(90vh-10rem))] overflow-y-auto px-10 py-4">
        <div className="flex w-full gap-5">
          {/* Label column */}
          <div className="flex w-[152px] shrink-0 flex-col gap-3">
            {formFields.map(field => (
              <div key={field.key} className="flex h-[30px] items-center py-1">
                <span className={labelClass}>{field.label}</span>
              </div>
            ))}
          </div>

          {/* Value / input column */}
          <div className="flex w-[200px] shrink-0 flex-col gap-3">
            {formFields.map(field => {
              const ui = ORDER_FORM_FIELD_UI[field.key]
              const isReadonly = ui.type === 'readonly'
              const isPlain = ui.plain === true
              const display = order != null ? formatOrderFormFieldValue(field.key, order) : '—'
              const missing = isMissing(field.key as keyof FormState)

              // id and order_date: always plain text (no border), show — in create mode
              if (field.key === 'id' || field.key === 'order_date') {
                const txt = isCreate ? '—' : display
                return (
                  <div key={field.key} className="flex h-[30px] items-center px-2 py-1">
                    <span className={valueClass}>{txt}</span>
                  </div>
                )
              }

              // order_status: badge display, only editable in edit mode (not create)
              if (field.key === 'order_status') {
                const statusVal = normalizeOrderStatus(isCreate ? 'CONFIRMED' : (isEditing ? form.order_status : (order?.order_status ?? 'CONFIRMED')))
                if (isEdit) {
                  return (
                    <div key={field.key} className="flex h-[30px] items-center">
                      <StatusPicker value={statusVal} onChange={v => setField('order_status', v)} />
                    </div>
                  )
                }
                return (
                  <div key={field.key} className="flex h-[30px] items-center">
                    <span className={cn(
                      'inline-flex h-[28px] items-center rounded-lg px-3 text-sm font-bold',
                      "font-['Noto_Sans_TC',sans-serif]",
                      orderStatusBadgeClasses(statusVal),
                    )}>
                      {orderStatusLabel(statusVal)}
                    </span>
                  </div>
                )
              }

              // Always read-only fields (other readonly types)
              if (isReadonly || !isEditing) {
                if (isPlain) {
                  return (
                    <div key={field.key} className="flex h-[30px] items-center px-2 py-1">
                      <span className={valueClass}>{display}</span>
                    </div>
                  )
                }
                return (
                  <div key={field.key} className={cn('flex h-[30px] items-center gap-2 rounded-lg px-2 py-1 border border-[#E0E0E0]', ui.type === 'select' && 'justify-between')}>
                    <span className={cn(valueClass, 'min-w-0 truncate')}>{display}</span>
                    {ui.type === 'select' && <ChevronDown className="h-5 w-5 shrink-0 text-black/60" strokeWidth={2} />}
                  </div>
                )
              }

              if (field.key === 'shipment_method') {
                return (
                  <div key={field.key} className="relative flex h-[30px] items-center">
                    <select
                      value={form.shipment_method}
                      onChange={e => setField('shipment_method', e.target.value as ShipmentMethod)}
                      className={cn(inputClass, 'cursor-pointer appearance-none pr-7')}
                    >
                      <option value="STORE_PICKUP">店取</option>
                      <option value="DELIVERY">外送</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" strokeWidth={2} />
                  </div>
                )
              }

              if (field.key === 'pay_status') {
                return (
                  <div key={field.key} className="relative flex h-[30px] items-center">
                    <select
                      value={form.pay_status}
                      onChange={e => setField('pay_status', e.target.value as PaymentStatus)}
                      className={cn(inputClass, 'cursor-pointer appearance-none pr-7')}
                    >
                      <option value="PENDING">待付款</option>
                      <option value="PAID">已付款</option>
                      <option value="FAILED">付款失敗</option>
                      <option value="REFUNDED">已退款</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" strokeWidth={2} />
                  </div>
                )
              }

              if (field.key === 'quantity') {
                return (
                  <div key={field.key} className="relative flex h-[30px] items-center">
                    <input
                      type="number"
                      min="1"
                      value={form.quantity}
                      placeholder={missing ? '此欄位不可為空' : ''}
                      onChange={e => setField('quantity', e.target.value)}
                      className={cn(inputClass, missing && missingInputClass)}
                    />
                  </div>
                )
              }

              if (field.key === 'total_amount') {
                return (
                  <div key={field.key} className="flex h-[30px] items-center">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.total_amount}
                      placeholder={missing ? '此欄位不可為空' : ''}
                      onChange={e => setField('total_amount', e.target.value)}
                      className={cn(inputClass, missing && missingInputClass)}
                    />
                  </div>
                )
              }

              if (field.key === 'send_datetime') {
                const datetimeMissing = isMissing('send_datetime')
                return (
                  <div key={field.key} className="flex h-[30px] items-center gap-1">
                    <input
                      type="date"
                      value={form.send_datetime_date}
                      title={datetimeMissing ? '此欄位不可為空' : undefined}
                      onChange={e => setField('send_datetime_date', e.target.value)}
                      className={cn(inputClass, 'w-[110px] shrink-0 px-1 text-sm', datetimeMissing && missingInputClass)}
                    />
                    <input
                      type="time"
                      step={300}
                      value={form.send_datetime_time}
                      onChange={e => setField('send_datetime_time', e.target.value)}
                      className={cn(inputClass, 'flex-1 px-1 text-sm', datetimeMissing && missingInputClass)}
                    />
                  </div>
                )
              }

              // Generic text field
              const key = field.key as keyof FormState
              return (
                <div key={field.key} className="flex h-[30px] items-center">
                  <input
                    type="text"
                    value={form[key] as string}
                    placeholder={missing ? '此欄位不可為空' : ''}
                    onChange={e => setField(key, e.target.value as FormState[typeof key])}
                    className={cn(inputClass, missing && missingInputClass)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 justify-center pb-8 pt-4">
        {isEditing ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (isEdit && !isDirty)}
            className={cn(
              'flex h-10 items-center gap-2 rounded-xl px-3 py-2',
              'text-base font-bold text-white shadow-[2px_2px_2px_rgba(0,0,0,0.25)]',
              "font-['Noto_Sans_TC',sans-serif] transition",
              saving || (isEdit && !isDirty)
                ? 'bg-[#C5C7FF] cursor-not-allowed'
                : 'bg-[#6168FC] hover:bg-[#4F51FF]',
            )}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isCreate ? (
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            ) : (
              <Check className="h-5 w-5" strokeWidth={2.5} />
            )}
            {isCreate ? '新增訂單' : '儲存變更'}
          </button>
        ) : null}
      </footer>

      {showLeaveConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[24px] bg-black/20">
          <div className="w-[280px] rounded-2xl bg-white px-6 py-5 shadow-xl font-['Noto_Sans_TC',sans-serif]">
            <p className="mb-1 text-base font-bold text-black">確定要離開？</p>
            <p className="mb-5 text-sm text-black/50">尚未儲存的變更將會遺失。</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-[#e0e3ed] text-sm font-bold text-black/60 transition hover:bg-[#F5F5F5] outline-none"
              >
                繼續編輯
              </button>
              <button
                type="button"
                onClick={() => { setShowLeaveConfirm(false); onClose?.() }}
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

function StatusPicker({ value, onChange }: { value: OrderStatus; onChange: (v: OrderStatus) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex h-[30px] items-center gap-1.5 rounded-lg px-2 text-sm font-bold transition',
          "font-['Noto_Sans_TC',sans-serif]",
          orderStatusBadgeClasses(value),
          'hover:opacity-90',
        )}
      >
        {orderStatusLabel(value)}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-xl border border-[#e9e9e9] bg-white p-2 shadow-lg">
          {ORDER_STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'flex w-full h-8 items-center justify-center rounded-lg px-2 text-sm font-bold transition mb-1 last:mb-0',
                "font-['Noto_Sans_TC',sans-serif]",
                orderStatusBadgeClasses(opt.value),
                opt.value === value ? 'ring-2 ring-[#6168FC] ring-offset-1' : 'opacity-75 hover:opacity-100',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
