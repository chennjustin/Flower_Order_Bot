import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, Loader2, Pencil, Sparkles } from 'lucide-react'
import {
  useSuggestOrderFromChat,
  useUpdateRoomOrder,
} from '@/hooks/useRoomOrders'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import type { Order, OrderPatchUpdate } from '@/types/domain'
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
  isOrderFormDirty,
  orderPatchToFormState,
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
  const suggestFromChat = useSuggestOrderFromChat()
  const { savedConfig } = useOrderDisplayConfig()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => formStateFromOrder(order))
  const [pendingMessageIds, setPendingMessageIds] = useState<number[]>([])
  const [aiPreviewHint, setAiPreviewHint] = useState(false)

  const orderStatus = normalizeOrderStatus(order.order_status)
  const isCancelled = orderStatus === 'CANCELLED'

  useEffect(() => {
    setForm(formStateFromOrder(order))
    setIsEditing(false)
    setPendingMessageIds([])
    setAiPreviewHint(false)
  }, [order])

  const isDirty = useMemo(() => isOrderFormDirty(form, order), [form, order])

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

  async function commitOrder(): Promise<boolean> {
    if (!isDirty) return false
    try {
      const patch: OrderPatchUpdate = {
        ...formStateToOrderPatch(form),
        ...(pendingMessageIds.length > 0
          ? { mark_processed_message_ids: pendingMessageIds }
          : {}),
      }
      const updated = await updateOrder.mutateAsync({
        orderId: order.id,
        patch,
      })
      onOrderUpdated?.(updated)
      setIsEditing(false)
      setPendingMessageIds([])
      setAiPreviewHint(false)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`更新訂單失敗：${message}`)
      return false
    }
  }

  async function handleAiImport() {
    if (isCancelled) return
    try {
      const result = await suggestFromChat.mutateAsync(order.id)
      setForm(orderPatchToFormState(result.suggested, order))
      setPendingMessageIds(result.source_message_ids)
      setAiPreviewHint(true)
      setIsEditing(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`從對話帶入失敗：${message}`)
    }
  }

  const isSaving = updateOrder.isPending
  const isSuggesting = suggestFromChat.isPending

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

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 pt-4">
          <button
            type="button"
            onClick={handleAiImport}
            disabled={isCancelled || isSuggesting || isSaving}
            className={cn(
              'flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#C5C7FF] bg-[#F5F6FF] text-sm font-bold text-[#6168FC] transition',
              "font-['Noto_Sans_TC',sans-serif]",
              'hover:bg-[#E8EAFF] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {isSuggesting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            <span>從對話 AI 帶入</span>
          </button>
          {aiPreviewHint && isEditing && (
            <p className="mt-2 text-center text-xs text-[#6168FC] font-['Noto_Sans_TC',sans-serif]">
              以下為 AI 建議，請確認後按「更新訂單」寫入資料庫
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-28">
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
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 z-20 flex flex-col items-center gap-1 px-4">
        <button
          type="button"
          onClick={commitOrder}
          disabled={!isDirty || isSaving || isCancelled}
          aria-disabled={!isDirty || isSaving || isCancelled}
          title={
            !isDirty
              ? '請先從對話帶入或編輯欄位後再更新訂單'
              : undefined
          }
          className={cn(
            'flex h-10 w-full max-w-[200px] items-center justify-center gap-2 rounded-xl px-3 text-base font-bold text-white transition active:scale-95',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none',
            isDirty && !isCancelled
              ? 'bg-[#6168FC] hover:bg-[#4F51FF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)]'
              : 'bg-[#C5C7FF]',
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          <span>更新訂單</span>
        </button>
      </div>
    </aside>
  )
}
