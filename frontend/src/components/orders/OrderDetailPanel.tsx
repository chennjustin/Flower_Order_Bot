import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, Loader2, Pencil } from 'lucide-react'
import { useUpdateOrder } from '@/hooks/useOrders'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import type { Order, OrderPatchUpdate } from '@/types/domain'
import type { OrderFieldKey } from '@/types/orderDisplay'
import { normalizeOrderStatus, orderStatusLabel } from '@/utils/orderStatus'
import { cn } from '@/lib/utils'
import {
  DRAFT_SUPPORTED_KEYS,
  DateTimeRow,
  FIELD_META,
  FormRow,
  formatReadOnly,
  formStateFromOrder,
  formStateToOrderPatchForOrder,
  isOrderFormDirty,
  type FieldDef,
  type FieldKey,
  type FormState,
} from '@/components/messages/orderDraftForm'

interface OrderDetailPanelProps {
  order: Order
  onBack: () => void
  onOrderUpdated?: (order: Order) => void
  onDirtyChange?: (dirty: boolean) => void
}

export default function OrderDetailPanel({
  order,
  onBack,
  onOrderUpdated,
  onDirtyChange,
}: OrderDetailPanelProps) {
  const updateOrder = useUpdateOrder()
  const { savedConfig } = useOrderDisplayConfig()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => formStateFromOrder(order))
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  const orderStatus = normalizeOrderStatus(order.order_status)
  const isCancelled = orderStatus === 'CANCELLED'

  useEffect(() => {
    setForm(formStateFromOrder(order))
    setIsEditing(false)
  }, [order])

  const isDirty = useMemo(() => isOrderFormDirty(form, order), [form, order])

  useEffect(() => {
    onDirtyChange?.(isDirty && isEditing)
  }, [isDirty, isEditing, onDirtyChange])

  const display = useMemo(() => {
    const status = normalizeOrderStatus(order.order_status)
    return {
      id: String(order.id),
      customer_name: order.customer_name ?? '',
      customer_phone: order.customer_phone ?? '',
      total_amount: order.total_amount != null ? `NT ${order.total_amount}` : '',
      item: order.item ?? '',
      quantity: order.quantity != null ? String(order.quantity) : '',
      note: order.note ?? '',
      shipment_method:
        order.shipment_method === 'STORE_PICKUP' ? '店取' : order.shipment_method === 'DELIVERY' ? '外送' : '',
      send_datetime: formatReadOnly(order.send_datetime),
      delivery_address: order.delivery_address ?? '',
      order_date: formatReadOnly(order.order_date),
      order_status: orderStatusLabel(status),
      pay_way: order.pay_way ?? '',
      pay_status:
        order.pay_status === 'PAID' ? '已付款'
        : order.pay_status === 'FAILED' ? '付款失敗'
        : order.pay_status === 'REFUNDED' ? '已退款'
        : '待付款',
    }
  }, [order])

  const visibleFields = useMemo<FieldDef[]>(() => {
    const supportedSet = new Set<OrderFieldKey>(DRAFT_SUPPORTED_KEYS)
    return [...savedConfig.fields]
      .sort((a, b) => a.order - b.order)
      .filter(f => f.visible && supportedSet.has(f.key))
      .map(f => {
        const base = { key: f.key as FieldKey, ...FIELD_META[f.key as FieldKey] }
        if (f.key === 'order_status') return { ...base, editable: true, variant: 'order_status' as const }
        return base
      })
  }, [savedConfig.fields])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function startEditing() {
    setForm(formStateFromOrder(order))
    setIsEditing(true)
  }

  async function commitOrder(): Promise<boolean> {
    if (!isDirty) { setIsEditing(false); return true }
    try {
      const patch: OrderPatchUpdate = formStateToOrderPatchForOrder(form, order)
      const updated = await updateOrder.mutateAsync({ orderId: order.id, patch })
      onOrderUpdated?.(updated)
      setIsEditing(false)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`更新訂單失敗：${message}`)
      return false
    }
  }

  function handleBack() {
    if (isDirty && isEditing) {
      setShowLeaveDialog(true)
    } else {
      onBack()
    }
  }

  const isSaving = updateOrder.isPending

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
          訂單 #{order.id}
        </span>
        <button
          type="button"
          onClick={isEditing ? commitOrder : startEditing}
          disabled={(isSaving && isEditing) || isCancelled}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D9D9D9] text-[#6168FC] transition hover:bg-[#C5C7FF] hover:text-white active:scale-95 disabled:opacity-60"
          aria-label={isEditing ? '儲存變更' : '開始編輯'}
        >
          {isSaving && isEditing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEditing ? (
            <Check className="h-4 w-4" />
          ) : (
            <Pencil className="h-4 w-4" />
          )}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <div className="flex flex-col gap-4">
          {visibleFields.map(field =>
            field.key === 'send_datetime' && isEditing ? (
              <DateTimeRow
                key={field.key}
                label={field.label}
                date={form.send_datetime_date}
                time={form.send_datetime_time}
                onDateChange={(v: string) => setField('send_datetime_date', v)}
                onTimeChange={(v: string) => setField('send_datetime_time', v)}
                missing={false}
              />
            ) : (
              <FormRow
                key={field.key}
                field={field}
                isEditing={isEditing && field.editable && !isCancelled}
                form={form}
                setField={setField}
                display={display}
                missing={false}
              />
            ),
          )}
        </div>
      </div>

      <div className="flex-shrink-0 px-4 py-3">
        <button
          type="button"
          onClick={commitOrder}
          disabled={!isDirty || isSaving || isCancelled || !isEditing}
          className={cn(
            'flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-base font-bold text-white transition active:scale-95',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
            isDirty && isEditing && !isCancelled
              ? 'bg-[#6168FC] hover:bg-[#4F51FF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)]'
              : 'bg-[#C5C7FF]',
          )}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          <span>更新訂單</span>
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
