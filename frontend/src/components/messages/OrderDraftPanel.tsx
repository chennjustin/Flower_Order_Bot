import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, Pencil, Plus } from 'lucide-react'
import OrderSidePanelToggle from './OrderSidePanelToggle'
import {
  useCreateOrder,
  useOrderDraft,
  useUpdateOrderDraft,
} from '@/hooks/useOrderDraft'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import type { OrderFieldKey } from '@/types/orderDisplay'
import { cn } from '@/lib/utils'
import {
  DRAFT_SUPPORTED_KEYS,
  DateTimeRow,
  EMPTY_FORM,
  FIELD_META,
  FormRow,
  MISSING_KEY_TO_FIELD,
  emptyDraftDisplay,
  formatReadOnly,
  formStateFromDraft,
  formStateToUpdate,
  type FieldDef,
  type FieldKey,
  type FormState,
} from './orderDraftForm'

interface OrderDraftPanelProps {
  roomId: number
  open: boolean
  onBack: () => void
  onClosePanel: () => void
}

export default function OrderDraftPanel({
  roomId,
  open,
  onBack,
  onClosePanel,
}: OrderDraftPanelProps) {
  const draftQuery = useOrderDraft(roomId, open)
  const updateDraft = useUpdateOrderDraft(roomId)
  const createOrder = useCreateOrder(roomId)
  const { savedConfig } = useOrderDisplayConfig()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [missing, setMissing] = useState<string[]>([])

  const draft = draftQuery.data ?? null

  useEffect(() => {
    if (!isEditing) {
      setForm(formStateFromDraft(draft))
    }
  }, [draft, isEditing])

  useEffect(() => {
    setIsEditing(false)
    setMissing([])
  }, [roomId])

  const display = useMemo(() => {
    if (!draft) return emptyDraftDisplay()
    return {
      id: String(draft.id),
      customer_name: draft.customer_name ?? '',
      customer_phone: draft.customer_phone ?? '',
      total_amount: draft.total_amount != null ? `NT ${draft.total_amount}` : '',
      item: draft.item ?? '',
      quantity: draft.quantity != null ? String(draft.quantity) : '',
      note: draft.note ?? '',
      shipment_method:
        draft.shipment_method === 'STORE_PICKUP'
          ? '店取'
          : draft.shipment_method === 'DELIVERY'
            ? '外送'
            : '',
      send_datetime: formatReadOnly(draft.send_datetime),
      delivery_address: draft.delivery_address ?? '',
      order_date: formatReadOnly(draft.order_date),
      order_status: '草稿',
      pay_way: draft.pay_way ?? '',
      pay_status:
        draft.pay_status === 'PAID'
          ? '已付款'
          : draft.pay_status === 'FAILED'
            ? '付款失敗'
            : draft.pay_status === 'REFUNDED'
              ? '已退款'
              : '待付款',
    }
  }, [draft])

  const visibleFields = useMemo<FieldDef[]>(() => {
    const supportedSet = new Set<OrderFieldKey>(DRAFT_SUPPORTED_KEYS)
    return [...savedConfig.fields]
      .sort((a, b) => a.order - b.order)
      .filter(field => field.visible && supportedSet.has(field.key))
      .map(field => ({ key: field.key as FieldKey, ...FIELD_META[field.key as FieldKey] }))
  }, [savedConfig.fields])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function startEditing() {
    if (!draft) {
      alert('尚無草稿，請先點聊天室上方「整理資料」產生草稿。')
      return
    }
    setForm(formStateFromDraft(draft))
    setIsEditing(true)
  }

  async function confirmEditing(): Promise<boolean> {
    if (!draft) {
      alert('尚無草稿，請先點聊天室上方「整理資料」產生草稿。')
      return false
    }
    try {
      await updateDraft.mutateAsync(formStateToUpdate(form))
      setIsEditing(false)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`更新訂單草稿失敗：${message}`)
      return false
    }
  }

  async function ensureSavedIfEditing(): Promise<boolean> {
    if (!isEditing) return true
    return confirmEditing()
  }

  async function handleCreateOrder() {
    if (!(await ensureSavedIfEditing())) return
    try {
      const result = await createOrder.mutateAsync()
      if (result.ok) {
        alert('訂單建立成功！')
        setMissing([])
        onBack()
      } else {
        setMissing(result.missing)
        alert('請填入缺少的資料')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`建立訂單失敗：${message}`)
    }
  }

  const missingFieldSet = useMemo(() => {
    const set = new Set<FieldKey>()
    for (const raw of missing) {
      const mapped = MISSING_KEY_TO_FIELD[raw]
      if (mapped) set.add(mapped)
    }
    return set
  }, [missing])

  function isFieldMissing(key: FieldKey): boolean {
    return missingFieldSet.has(key)
  }

  const isPending = updateDraft.isPending || createOrder.isPending

  return (
    <aside className="relative flex h-full w-[336px] flex-shrink-0 flex-col border-l border-[#B3B3B3] bg-white">
      <OrderSidePanelToggle mode="close" onClick={onClosePanel} />

      <header className="flex h-20 flex-shrink-0 items-center gap-3 border-b-[1.5px] border-[#e9e9e9] px-4 pl-5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-[#F5F6FF] hover:text-[#6168FC] active:scale-95"
          aria-label="返回訂單詳情"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-lg font-bold text-black font-['Noto_Sans_TC',sans-serif]">
          訂單草稿
        </span>
        {draft && (
          <button
            type="button"
            onClick={isEditing ? confirmEditing : startEditing}
            disabled={isPending && !isEditing}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D9D9D9] text-[#6168FC] transition hover:bg-[#C5C7FF] hover:text-white active:scale-95 disabled:opacity-60"
            aria-label={isEditing ? '完成編輯' : '開始編輯'}
          >
            {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
        {draftQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-black/40">載入中...</div>
        ) : draftQuery.error ? (
          <div className="py-10 text-center text-sm text-red-600">
            無法載入訂單草稿：{(draftQuery.error as Error).message}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {!draft && !isEditing && (
              <p
                className={cn(
                  'rounded-lg bg-[#FAFAFA] px-3 py-2 text-center text-xs text-black/45',
                  "font-['Noto_Sans_TC',sans-serif]",
                )}
              >
                尚無草稿內容，請先點聊天室上方「整理資料」。
              </p>
            )}
            {visibleFields.map(field =>
              field.key === 'send_datetime' && isEditing ? (
                <DateTimeRow
                  key={field.key}
                  label={field.label}
                  date={form.send_datetime_date}
                  time={form.send_datetime_time}
                  onDateChange={v => setField('send_datetime_date', v)}
                  onTimeChange={v => setField('send_datetime_time', v)}
                  missing={isFieldMissing('send_datetime')}
                />
              ) : (
                <FormRow
                  key={field.key}
                  field={field}
                  isEditing={isEditing && field.editable && draft != null}
                  form={form}
                  setField={setField}
                  display={display}
                  missing={isFieldMissing(field.key)}
                />
              ),
            )}
          </div>
        )}
      </div>

      {(draft || isEditing) && (
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center">
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={isPending || isEditing}
            aria-disabled={isPending || isEditing}
            title={isEditing ? '請先完成編輯（點 ✓）後再建立新訂單' : undefined}
            className={cn(
              'flex h-10 w-[200px] items-center justify-center gap-2 rounded-xl px-3 text-base font-bold text-white transition active:scale-95',
              "font-['Noto_Sans_TC',sans-serif]",
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none',
              isEditing
                ? 'bg-[#C5C7FF]'
                : 'bg-[#6168FC] hover:bg-[#4F51FF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)]',
            )}
          >
            <Plus className="h-4 w-4" />
            <span>建立新訂單</span>
          </button>
        </div>
      )}
    </aside>
  )
}
