import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, Pencil } from 'lucide-react'
import { useUpdateRoomOrder } from '@/hooks/useRoomOrders'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import type { Order } from '@/types/domain'
import type { OrderFieldKey } from '@/types/orderDisplay'
import {
  normalizeOrderStatus,
  orderStatusLabel,
} from '@/utils/orderStatus'
import { cn } from '@/lib/utils'
import OrderSidePanelToggle from './OrderSidePanelToggle'
import {
  DRAFT_SUPPORTED_KEYS,
  DateTimeRow,
  FIELD_META,
  FormRow,
  formatReadOnly,
  formStateFromOrder,
  formStateToOrderPatch,
  type FieldDef,
  type FieldKey,
  type FormState,
} from './orderDraftForm'

interface OrderEditPanelProps {
  roomId: number
  order: Order
  onBack: () => void
  onClosePanel: () => void
  onOrderUpdated?: (order: Order) => void
}

export default function OrderEditPanel({
  roomId,
  order,
  onBack,
  onClosePanel,
  onOrderUpdated,
}: OrderEditPanelProps) {
  const updateOrder = useUpdateRoomOrder(roomId)
  const { savedConfig } = useOrderDisplayConfig()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => formStateFromOrder(order))

  useEffect(() => {
    setForm(formStateFromOrder(order))
    setIsEditing(false)
  }, [order])

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
        order.shipment_method === 'STORE_PICKUP'
          ? '店取'
          : order.shipment_method === 'DELIVERY'
            ? '外送'
            : '',
      send_datetime: formatReadOnly(order.send_datetime),
      delivery_address: order.delivery_address ?? '',
      order_date: formatReadOnly(order.order_date),
      order_status: orderStatusLabel(status),
      pay_way: order.pay_way ?? '',
      pay_status:
        order.pay_status === 'PAID'
          ? '已付款'
          : order.pay_status === 'FAILED'
            ? '付款失敗'
            : order.pay_status === 'REFUNDED'
              ? '已退款'
              : '待付款',
    }
  }, [order])

  const visibleFields = useMemo<FieldDef[]>(() => {
    const supportedSet = new Set<OrderFieldKey>(DRAFT_SUPPORTED_KEYS)
    return [...savedConfig.fields]
      .sort((a, b) => a.order - b.order)
      .filter(field => field.visible && supportedSet.has(field.key))
      .map(field => {
        const base = { key: field.key as FieldKey, ...FIELD_META[field.key as FieldKey] }
        if (field.key === 'order_status') {
          return { ...base, editable: true, variant: 'order_status' as const }
        }
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

  async function confirmEditing(): Promise<boolean> {
    try {
      const updated = await updateOrder.mutateAsync({
        orderId: order.id,
        patch: formStateToOrderPatch(form),
      })
      onOrderUpdated?.(updated)
      setIsEditing(false)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`更新訂單失敗：${message}`)
      return false
    }
  }

  const isPending = updateOrder.isPending

  return (
    <aside className="relative flex h-full w-[336px] flex-shrink-0 flex-col border-l border-[#B3B3B3] bg-white">
      <OrderSidePanelToggle mode="close" onClick={onClosePanel} />

      <header className="flex h-20 flex-shrink-0 items-center gap-3 border-b-[1.5px] border-[#e9e9e9] px-4 pl-5">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-[#528DD2] transition',
            "font-['Noto_Sans_TC',sans-serif]",
            'hover:bg-[#D8EAFF]/60 active:scale-95',
          )}
          aria-label="返回訂單詳情"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span>返回</span>
        </button>
        <span className="min-w-0 flex-1 truncate text-lg font-bold text-black font-['Noto_Sans_TC',sans-serif]">
          訂單 #{order.id}
        </span>
        <button
          type="button"
          onClick={isEditing ? confirmEditing : startEditing}
          disabled={isPending && !isEditing}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D9D9D9] text-[#6168FC] transition hover:bg-[#C5C7FF] hover:text-white active:scale-95 disabled:opacity-60"
          aria-label={isEditing ? '儲存變更' : '開始編輯'}
        >
          {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-8">
        <div className="flex flex-col gap-4">
          {visibleFields.map(field =>
            field.key === 'send_datetime' && isEditing ? (
              <DateTimeRow
                key={field.key}
                label={field.label}
                date={form.send_datetime_date}
                time={form.send_datetime_time}
                onDateChange={v => setField('send_datetime_date', v)}
                onTimeChange={v => setField('send_datetime_time', v)}
                missing={false}
              />
            ) : (
              <FormRow
                key={field.key}
                field={field}
                isEditing={isEditing && field.editable}
                form={form}
                setField={setField}
                display={display}
                missing={false}
              />
            ),
          )}
        </div>
        {isEditing && (
          <p className="mt-4 text-center text-xs text-black/40 font-['Noto_Sans_TC',sans-serif]">
            點上方 ✓ 儲存至資料庫
          </p>
        )}
      </div>
    </aside>
  )
}
