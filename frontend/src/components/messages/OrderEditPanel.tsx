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
import {
  DRAFT_SUPPORTED_KEYS,
  DateTimeRow,
  FIELD_META,
  FormRow,
  formatReadOnly,
  formStateFromOrder,
  formStateToOrderPatchForOrder,
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
  onDirtyChange?: (dirty: boolean) => void
}

export default function OrderEditPanel({
  roomId,
  order,
  onBack,
  onClosePanel: _onClosePanel,
  onOrderUpdated,
  onDirtyChange,
}: OrderEditPanelProps) {
  const updateOrder = useUpdateRoomOrder(roomId)
  const suggestFromChat = useSuggestOrderFromChat()
  const { savedConfig } = useOrderDisplayConfig()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => formStateFromOrder(order))
  const [pendingMessageIds, setPendingMessageIds] = useState<number[]>([])
  const [aiPreviewHint, setAiPreviewHint] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  const orderStatus = normalizeOrderStatus(order.order_status)
  const isCancelled = orderStatus === 'CANCELLED'

  useEffect(() => {
    setForm(formStateFromOrder(order))
    setIsEditing(false)
    setPendingMessageIds([])
    setAiPreviewHint(false)
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
        ...formStateToOrderPatchForOrder(form, order),
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

  const REQUIRED_FIELDS: { key: keyof FormState; label: string }[] = [
    { key: 'item', label: '品項' },
    { key: 'customer_name', label: '客戶姓名' },
    { key: 'customer_phone', label: '客戶電話' },
    { key: 'quantity', label: '數量' },
    { key: 'total_amount', label: '總金額' },
  ]

  function handleBack() {
    if (isDirty) {
      setShowLeaveDialog(true)
    } else {
      onBack()
    }
  }

  return (
    <aside className="relative flex h-full w-[336px] flex-shrink-0 flex-col border-l border-[#B3B3B3] bg-white">
      <header className="flex h-20 flex-shrink-0 items-center gap-2 border-b-[1.5px] border-[#e9e9e9] px-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-[#F5F6FF] hover:text-[#6168FC] active:scale-95"
          aria-label="返回訂單詳情"
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
        {aiPreviewHint && isEditing && (
          <p className="mb-3 text-center text-xs text-[#6168FC] font-['Noto_Sans_TC',sans-serif]">
            以下為 AI 建議，請確認後按「更新訂單」寫入資料庫
          </p>
        )}
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
                isEditing={isEditing && field.editable}
                form={form}
                setField={setField}
                display={display}
                missing={isEditing && REQUIRED_FIELDS.some(r => r.key === field.key) && !String(form[field.key as keyof FormState] ?? '').trim()}
              />
            ),
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex gap-2 px-4 py-3">
        <button
          type="button"
          onClick={handleAiImport}
          disabled={isCancelled || isSuggesting || isSaving}
          className={cn(
            'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#C5C7FF] bg-[#F5F6FF] text-sm font-bold text-[#6168FC] transition',
            "font-['Noto_Sans_TC',sans-serif]",
            'hover:bg-[#E8EAFF] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSuggesting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          <span>AI 整理</span>
        </button>
        <button
          type="button"
          onClick={commitOrder}
          disabled={!isDirty || isSaving || isCancelled}
          title={!isDirty ? '請先從對話帶入或編輯欄位後再更新訂單' : undefined}
          className={cn(
            'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white transition active:scale-95',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
            isDirty && !isCancelled
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
