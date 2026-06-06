import type {
  Order,
  OrderDraft,
  OrderDraftUpdate,
  OrderPatchUpdate,
} from '@/types/domain'
import type { OrderStatus, PaymentStatus, ShipmentMethod } from '@/types/enums'
import type { OrderFieldKey } from '@/types/orderDisplay'
import {
  ORDER_STATUS_OPTIONS,
  normalizeOrderStatus,
  orderStatusBadgeClasses,
  orderStatusLabel,
} from '@/utils/orderStatus'
import { cn } from '@/lib/utils'

export type EditableKey =
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
  | 'pay_status'

export type ReadOnlyKey = 'id' | 'order_date' | 'order_status'

export type FieldKey = EditableKey | ReadOnlyKey

export interface FieldDef {
  key: FieldKey
  label: string
  editable: boolean
  variant?: 'text' | 'number' | 'amount' | 'select' | 'datetime' | 'order_status'
}

/** Maps backend missing-field keys to editable draft columns. */
export const MISSING_KEY_TO_FIELD: Record<string, FieldKey> = {
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
  pay_status: 'pay_status',
  note: 'note',
}

export const FIELD_META: Record<FieldKey, Omit<FieldDef, 'key'>> = {
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
  order_status: { label: '狀態', editable: false, variant: 'order_status' },
  pay_way: { label: '付款方式', editable: true },
  pay_status: { label: '付款狀態', editable: true, variant: 'select' },
}

export const DRAFT_SUPPORTED_KEYS: OrderFieldKey[] = [
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

export interface FormState {
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
  pay_status: PaymentStatus
  order_status: OrderStatus
}

export const EMPTY_FORM: FormState = {
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
  pay_status: 'PENDING',
  order_status: 'CONFIRMED',
}

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function splitDateTime(iso: string | null | undefined): { date: string; time: string } {
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

export function formStateFromDraft(draft: OrderDraft | null | undefined): FormState {
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
    pay_status: draft.pay_status ?? 'PENDING',
    order_status: 'CONFIRMED',
  }
}

export function formStateFromOrder(order: Order): FormState {
  const { date, time } = splitDateTime(order.send_datetime)
  return {
    customer_name: order.customer_name ?? '',
    customer_phone: order.customer_phone ?? '',
    total_amount: order.total_amount != null ? String(order.total_amount) : '',
    item: order.item ?? '',
    quantity: order.quantity != null ? String(order.quantity) : '',
    note: order.note ?? '',
    shipment_method: order.shipment_method ?? 'STORE_PICKUP',
    send_datetime_date: date,
    send_datetime_time: time,
    delivery_address: order.delivery_address ?? '',
    pay_way: order.pay_way ?? '',
    pay_status: order.pay_status ?? 'PENDING',
    order_status: order.order_status ?? 'CONFIRMED',
  }
}

/** Apply a suggested PATCH onto form state (preview before save). */
export function orderPatchToFormState(
  patch: OrderPatchUpdate,
  order: Order,
): FormState {
  const merged: Order = {
    ...order,
    customer_name: patch.customer_name ?? order.customer_name,
    customer_phone: patch.customer_phone ?? order.customer_phone,
    total_amount: patch.total_amount ?? order.total_amount,
    pay_status: patch.pay_status ?? order.pay_status,
    item: patch.item ?? order.item,
    quantity: patch.quantity ?? order.quantity,
    note: patch.note ?? order.note,
    shipment_method: patch.shipment_method ?? order.shipment_method,
    send_datetime: patch.send_datetime ?? order.send_datetime,
    delivery_address: patch.delivery_address ?? order.delivery_address,
    pay_way: patch.pay_way ?? order.pay_way,
    order_status: patch.order_status ?? order.order_status,
  }
  return formStateFromOrder(merged)
}

/** True when form differs from the loaded order snapshot. */
export function isOrderFormDirty(form: FormState, order: Order): boolean {
  const baseline = formStateFromOrder(order)
  return (Object.keys(form) as (keyof FormState)[]).some(
    key => form[key] !== baseline[key],
  )
}

/** Payload for PATCH /orders/{order_id}. */
export function formStateToOrderPatch(form: FormState) {
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
    pay_status: form.pay_status,
    order_status: form.order_status,
  }
}

export function formStateToUpdate(form: FormState): OrderDraftUpdate {
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
    pay_status: form.pay_status,
  }
}

const EMPTY_DISPLAY_DASH = '—'

/** Placeholder display row when no draft record exists yet. */
export function emptyDraftDisplay(): Record<FieldKey, string> {
  return {
    id: EMPTY_DISPLAY_DASH,
    customer_name: EMPTY_DISPLAY_DASH,
    customer_phone: EMPTY_DISPLAY_DASH,
    total_amount: EMPTY_DISPLAY_DASH,
    item: EMPTY_DISPLAY_DASH,
    quantity: EMPTY_DISPLAY_DASH,
    note: EMPTY_DISPLAY_DASH,
    shipment_method: EMPTY_DISPLAY_DASH,
    send_datetime: EMPTY_DISPLAY_DASH,
    delivery_address: EMPTY_DISPLAY_DASH,
    order_date: EMPTY_DISPLAY_DASH,
    order_status: EMPTY_DISPLAY_DASH,
    pay_way: EMPTY_DISPLAY_DASH,
    pay_status: EMPTY_DISPLAY_DASH,
  }
}

export function formatReadOnly(value: string | null | undefined): string {
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

interface FormRowProps {
  field: FieldDef
  isEditing: boolean
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  display: Record<FieldKey, string> | null
  missing: boolean
}

export function FormRow({
  field,
  isEditing,
  form,
  setField,
  display,
  missing,
}: FormRowProps) {
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
        ) : field.variant === 'order_status' && field.editable ? (
          <OrderStatusBadge status={normalizeOrderStatus(form.order_status)} />
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

/** Colored status badge (matches dashboard OrderTable). */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 min-w-[88px] items-center justify-center rounded-lg px-3 text-sm font-bold',
        "font-['Noto_Sans_TC',sans-serif]",
        orderStatusBadgeClasses(status),
      )}
    >
      {orderStatusLabel(status)}
    </span>
  )
}

/** Three selectable status blocks for edit mode. */
export function OrderStatusBlockPicker({
  value,
  onChange,
}: {
  value: OrderStatus
  onChange: (status: OrderStatus) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUS_OPTIONS.map(option => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'inline-flex h-8 min-w-[88px] items-center justify-center rounded-lg px-3 text-sm font-bold transition',
              "font-['Noto_Sans_TC',sans-serif]",
              orderStatusBadgeClasses(option.value),
              selected
                ? 'ring-2 ring-[#6168FC] ring-offset-1 shadow-sm'
                : 'opacity-75 hover:opacity-100',
            )}
          >
            {option.label}
          </button>
        )
      })}
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

  if (field.variant === 'select' && field.key === 'pay_status') {
    return (
      <select
        value={form.pay_status}
        onChange={e => setField('pay_status', e.target.value as PaymentStatus)}
        className={cn(inputClasses, 'cursor-pointer appearance-none')}
      >
        <option value="PENDING">待付款</option>
        <option value="PAID">已付款</option>
        <option value="FAILED">付款失敗</option>
        <option value="REFUNDED">已退款</option>
      </select>
    )
  }

  if (field.variant === 'order_status' || field.key === 'order_status') {
    return (
      <OrderStatusBlockPicker
        value={normalizeOrderStatus(form.order_status)}
        onChange={status => setField('order_status', status)}
      />
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

export function DateTimeRow({
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
