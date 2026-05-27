import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsRight, Pencil, Plus, Upload } from 'lucide-react'
import {
  useCreateOrder,
  useOrderDraft,
  useUpdateOrder,
  useUpdateOrderDraft,
} from '@/hooks/useOrderDraft'
import type { OrderDraft, OrderDraftUpdate } from '@/types/domain'
import type { ShipmentMethod } from '@/types/enums'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import type { OrderFieldKey } from '@/types/orderDisplay'
import { cn } from '@/lib/utils'

type EditableKey =
  | 'customer_name'
  | 'customer_phone'
  | 'total_amount'
  | 'item'
  | 'quantity'
  | 'note'
  | 'shipment_method'
  | 'send_datetime'
  | 'delivery_address'
  | 'pay_way'

type ReadOnlyKey = 'id' | 'order_date' | 'order_status' | 'pay_status'

type FieldKey = EditableKey | ReadOnlyKey

interface FieldDef {
  key: FieldKey
  label: string
  editable: boolean
  variant?: 'text' | 'number' | 'amount' | 'select' | 'datetime'
}

/**
 * Backend missing-field keys (from POST /order/:roomId) don't always match
 * the frontend column keys. This table folds every backend variant into the
 * relevant editable column so the UI can flag the right row in red.
 */
const MISSING_KEY_TO_FIELD: Record<string, FieldKey> = {
  user_id: 'customer_name',
  user: 'customer_name',
  user_name: 'customer_name',
  customer_name: 'customer_name',
  user_phone: 'customer_phone',
  customer_phone: 'customer_phone',
  item_type: 'item',
  item: 'item',
  quantity: 'quantity',
  total_amount: 'total_amount',
  shipment_method: 'shipment_method',
  send_datetime: 'send_datetime',
  delivery_address: 'delivery_address',
  pay_way: 'pay_way',
  note: 'note',
}

const FIELD_META: Record<FieldKey, Omit<FieldDef, 'key'>> = {
  id: { label: '訂單編號', editable: false },
  customer_name: { label: '客戶姓名', editable: true },
  customer_phone: { label: '客戶電話', editable: true },
  total_amount: { label: '總金額', editable: true, variant: 'amount' },
  item: { label: '品項', editable: true },
  quantity: { label: '數量', editable: true, variant: 'number' },
  note: { label: '備註', editable: true },
  shipment_method: { label: '取貨方式', editable: true, variant: 'select' },
  send_datetime: { label: '送貨日期', editable: true, variant: 'datetime' },
  delivery_address: { label: '送貨地址', editable: true },
  order_date: { label: '訂單日期', editable: false },
  order_status: { label: '狀態', editable: false },
  pay_way: { label: '付款方式', editable: true },
  pay_status: { label: '付款狀態', editable: false },
}

const DRAFT_SUPPORTED_KEYS: OrderFieldKey[] = [
  'id',
  'customer_name',
  'customer_phone',
  'item',
  'quantity',
  'note',
  'shipment_method',
  'send_datetime',
  'total_amount',
  'pay_way',
  'pay_status',
  'delivery_address',
  'order_date',
  'order_status',
]

interface FormState {
  customer_name: string
  customer_phone: string
  total_amount: string
  item: string
  quantity: string
  note: string
  shipment_method: ShipmentMethod
  send_datetime_date: string
  send_datetime_time: string
  delivery_address: string
  pay_way: string
}

const EMPTY_FORM: FormState = {
  customer_name: '',
  customer_phone: '',
  total_amount: '',
  item: '',
  quantity: '',
  note: '',
  shipment_method: 'STORE_PICKUP',
  send_datetime_date: '',
  send_datetime_time: '',
  delivery_address: '',
  pay_way: '',
}

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function splitDateTime(iso: string | null | undefined): {
  date: string
  time: string
} {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  }
}

function combineDateTimeIso(date: string, time: string): string | null {
  if (!date) return null
  const stamp = `${date}T${time || '00:00'}:00`
  const d = new Date(stamp)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function formStateFromDraft(draft: OrderDraft | null | undefined): FormState {
  if (!draft) return EMPTY_FORM
  const { date, time } = splitDateTime(draft.send_datetime)
  return {
    customer_name: draft.customer_name ?? '',
    customer_phone: draft.customer_phone ?? '',
    total_amount: draft.total_amount != null ? String(draft.total_amount) : '',
    item: draft.item ?? '',
    quantity: draft.quantity != null ? String(draft.quantity) : '',
    note: draft.note ?? '',
    shipment_method: (draft.shipment_method as ShipmentMethod) ?? 'STORE_PICKUP',
    send_datetime_date: date,
    send_datetime_time: time,
    delivery_address: draft.delivery_address ?? '',
    pay_way: draft.pay_way ?? '',
  }
}

function formStateToUpdate(form: FormState): OrderDraftUpdate {
  const total = Number.parseFloat(form.total_amount)
  const qty = Number.parseInt(form.quantity, 10)
  return {
    customer_name: form.customer_name || null,
    customer_phone: form.customer_phone || null,
    total_amount: Number.isFinite(total) ? total : null,
    item: form.item || null,
    quantity: Number.isFinite(qty) ? qty : null,
    note: form.note || null,
    shipment_method: form.shipment_method,
    send_datetime: combineDateTimeIso(form.send_datetime_date, form.send_datetime_time),
    delivery_address: form.delivery_address || null,
    pay_way: form.pay_way || null,
  }
}

function formatReadOnly(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface DetailPanelProps {
  roomId: number
  open: boolean
  onClose: () => void
}

export default function DetailPanel({ roomId, open, onClose }: DetailPanelProps) {
  const draftQuery = useOrderDraft(roomId, open)
  const updateDraft = useUpdateOrderDraft(roomId)
  const updateOrder = useUpdateOrder(roomId)
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
    if (!draft) return null
    return {
      id: String(draft.id),
      customer_name: draft.customer_name ?? '',
      customer_phone: draft.customer_phone ?? '',
      total_amount:
        draft.total_amount != null ? `NT ${draft.total_amount}` : '',
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
      pay_status: '—',
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
    setForm(formStateFromDraft(draft))
    setIsEditing(true)
  }

  async function confirmEditing(): Promise<boolean> {
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

  async function handleUpdateOrder() {
    if (!(await ensureSavedIfEditing())) return
    try {
      await updateOrder.mutateAsync()
      alert('工單更新成功！')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`更新工單失敗：${message}`)
    }
  }

  async function handleCreateOrder() {
    if (!(await ensureSavedIfEditing())) return
    try {
      const result = await createOrder.mutateAsync()
      if (result.ok) {
        alert('工單建立成功！')
        setMissing([])
      } else {
        setMissing(result.missing)
        alert('請填入缺少的資料')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`建立工單失敗：${message}`)
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

  const isPending =
    updateDraft.isPending || updateOrder.isPending || createOrder.isPending

  return (
    <aside className="relative flex h-full w-[336px] flex-shrink-0 flex-col border-l border-[#B3B3B3] bg-white">
      <header className="flex h-20 flex-shrink-0 items-center justify-between border-b-[1.5px] border-[#e9e9e9] px-6">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-black font-['Noto_Sans_TC',sans-serif]">
            訂單草稿
          </span>
          <button
            type="button"
            onClick={isEditing ? confirmEditing : startEditing}
            disabled={isPending && !isEditing}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D9D9D9] text-[#6168FC] transition hover:bg-[#C5C7FF] hover:text-white active:scale-95 disabled:opacity-60"
            aria-label={isEditing ? '完成編輯' : '開始編輯'}
          >
            {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D8EAFF] text-[#528DD2] transition hover:bg-[#77B5FF] hover:text-white active:scale-95"
          aria-label="收起訂單詳情"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
        {draftQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-black/40">載入中...</div>
        ) : draftQuery.error ? (
          <div className="py-10 text-center text-sm text-red-600">
            無法載入訂單草稿：{(draftQuery.error as Error).message}
          </div>
        ) : !draft && !isEditing ? (
          <div className="py-10 text-center text-sm text-black/40">
            尚未產生訂單草稿，請先點上方「整理資料」。
          </div>
        ) : (
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
                  missing={isFieldMissing('send_datetime')}
                />
              ) : (
                <FormRow
                  key={field.key}
                  field={field}
                  isEditing={isEditing && field.editable}
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

      <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
        <button
          type="button"
          onClick={handleUpdateOrder}
          disabled={isPending || isEditing}
          aria-disabled={isPending || isEditing}
          title={isEditing ? '請先完成編輯（點 ✓）後再更新工單' : undefined}
          className={cn(
            'flex h-10 w-[136px] items-center justify-center gap-2 rounded-xl px-3 text-base font-bold text-white transition active:scale-95',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none',
            isEditing
              ? 'bg-[#D8EAFF] text-[#528DD2]'
              : 'bg-[#77B5FF] hover:bg-[#5C9FE8] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)]',
          )}
        >
          <Upload className="h-4 w-4" />
          <span>更新工單</span>
        </button>
        <button
          type="button"
          onClick={handleCreateOrder}
          disabled={isPending || isEditing}
          aria-disabled={isPending || isEditing}
          title={isEditing ? '請先完成編輯（點 ✓）後再建立新工單' : undefined}
          className={cn(
            'flex h-10 w-[136px] items-center justify-center gap-2 rounded-xl px-3 text-base font-bold text-white transition active:scale-95',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none',
            isEditing
              ? 'bg-[#C5C7FF]'
              : 'bg-[#6168FC] hover:bg-[#4F51FF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)]',
          )}
        >
          <Plus className="h-4 w-4" />
          <span>建立新工單</span>
        </button>
      </div>
    </aside>
  )
}

interface FormRowProps {
  field: FieldDef
  isEditing: boolean
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  display: Record<FieldKey, string> | null
  missing: boolean
}

function FormRow({ field, isEditing, form, setField, display, missing }: FormRowProps) {
  const labelClasses = cn(
    'w-[110px] flex-shrink-0 font-bold font-["Noto_Sans_TC",sans-serif] text-base text-black/[0.87]',
    missing && 'text-red-600',
  )

  return (
    <div className="flex min-h-8 items-center gap-2">
      <div className={labelClasses}>{field.label}</div>
      <div className="flex-1">
        {isEditing ? (
          renderEditor(field, form, setField, missing)
        ) : missing ? (
          <span
            className={cn(
              "block w-full rounded-md border-[1.5px] border-red-500 bg-red-50 px-3 py-1.5 font-bold text-red-600",
              "font-['Noto_Sans_TC',sans-serif] text-base",
            )}
          >
            {display?.[field.key] || '請填寫'}
          </span>
        ) : (
          <span
            className={cn(
              "font-bold font-['Noto_Sans_TC',sans-serif] text-base text-black",
            )}
          >
            {display?.[field.key] || '—'}
          </span>
        )}
      </div>
    </div>
  )
}

function renderEditor(
  field: FieldDef,
  form: FormState,
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void,
  missing: boolean,
) {
  const inputClasses = cn(
    'w-full rounded-md border-[1.5px] border-[#e0e3ed] bg-[#fafbff] px-3 py-2 text-[15px] text-black outline-none transition',
    "font-['Noto_Sans_TC',sans-serif]",
    'focus:border-[#6168FC] focus:shadow-[0_0_0_2px_#e4e7ff]',
    missing && 'border-red-500 bg-red-50 focus:shadow-[0_0_0_2px_rgba(220,53,69,0.25)]',
  )

  if (field.variant === 'select' && field.key === 'shipment_method') {
    return (
      <select
        value={form.shipment_method}
        onChange={e => setField('shipment_method', e.target.value as ShipmentMethod)}
        className={cn(inputClasses, 'cursor-pointer appearance-none')}
      >
        <option value="STORE_PICKUP">店取</option>
        <option value="DELIVERY">外送</option>
      </select>
    )
  }

  if (field.variant === 'number' && field.key === 'quantity') {
    return (
      <input
        type="number"
        min="0"
        value={form.quantity}
        onChange={e => setField('quantity', e.target.value)}
        className={inputClasses}
      />
    )
  }

  if (field.variant === 'amount' && field.key === 'total_amount') {
    return (
      <input
        type="number"
        min="0"
        step="0.01"
        value={form.total_amount}
        onChange={e => setField('total_amount', e.target.value)}
        className={inputClasses}
      />
    )
  }

  const key = field.key as keyof FormState
  return (
    <input
      type="text"
      value={form[key] as string}
      onChange={e => setField(key, e.target.value as FormState[typeof key])}
      className={inputClasses}
    />
  )
}

interface DateTimeRowProps {
  label: string
  date: string
  time: string
  onDateChange: (v: string) => void
  onTimeChange: (v: string) => void
  missing: boolean
}

function DateTimeRow({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
  missing,
}: DateTimeRowProps) {
  const inputClasses = cn(
    'w-full rounded-md border-[1.5px] border-[#e0e3ed] bg-[#fafbff] px-3 py-2 text-[15px] text-black outline-none transition',
    "font-['Noto_Sans_TC',sans-serif]",
    'focus:border-[#6168FC] focus:shadow-[0_0_0_2px_#e4e7ff]',
    missing && 'border-red-500 bg-red-50 focus:shadow-[0_0_0_2px_rgba(220,53,69,0.25)]',
  )
  const labelClasses = cn(
    'w-[110px] flex-shrink-0 font-bold font-["Noto_Sans_TC",sans-serif] text-base text-black/[0.87]',
    missing && 'text-red-600',
  )

  return (
    <>
      <div className="flex min-h-8 items-center gap-2">
        <div className={labelClasses}>{label}</div>
        <div className="flex-1">
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>
      <div className="flex min-h-8 items-center gap-2">
        <div className="w-[110px] flex-shrink-0" />
        <div className="flex-1">
          <input
            type="time"
            step={300}
            value={time}
            onChange={e => onTimeChange(e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>
    </>
  )
}
