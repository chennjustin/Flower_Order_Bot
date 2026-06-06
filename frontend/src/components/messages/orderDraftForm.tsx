import type {
  Order,
  OrderDraft,
  OrderDraftUpdate,
  OrderPatchUpdate,
} from '@/types/domain'
import type { OrderStatus, PaymentStatus, ShipmentMethod } from '@/types/enums'
import { getRegistryEntry } from '@/config/orderDisplayFields'
import type { OrderFieldKey } from '@/types/orderDisplay'
import {
  ORDER_STATUS_OPTIONS,
  normalizeOrderStatus,
  orderStatusBadgeClasses,
  orderStatusLabel,
} from '@/utils/orderStatus'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  AI_CHANGED_INPUT_CLASS,
  AI_CHANGED_VALUE_CLASS,
} from '@/lib/llmChangedFields'

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

const NUMERIC_MISSING_CATALOG_KEYS = new Set(['total_amount', 'quantity'])

/**
 * Mirrors backend `is_catalog_value_empty` — true when a previously-missing
 * catalog key now has an acceptable value on the saved draft.
 */
export function isMissingCatalogKeyFilled(
  catalogKey: string,
  draft: OrderDraft,
): boolean {
  if (NUMERIC_MISSING_CATALOG_KEYS.has(catalogKey)) {
    if (catalogKey === 'total_amount') {
      return draft.total_amount != null && draft.total_amount > 0
    }
    if (catalogKey === 'quantity') {
      return draft.quantity != null && draft.quantity > 0
    }
  }

  switch (catalogKey) {
    case 'customer_name':
      return Boolean(draft.customer_name?.trim())
    case 'customer_phone':
      return Boolean(draft.customer_phone?.trim())
    case 'item':
    case 'item_type':
      return Boolean(draft.item?.trim())
    case 'send_datetime':
      return Boolean(draft.send_datetime)
    case 'note':
      return Boolean(draft.note?.trim())
    case 'delivery_address':
      return Boolean(draft.delivery_address?.trim())
    case 'pay_way':
      return Boolean(draft.pay_way?.trim())
    case 'shipment_method':
      return draft.shipment_method != null
    case 'pay_status':
      return draft.pay_status != null
    default:
      return false
  }
}

/** Drop only catalog keys that are no longer empty after a successful save (✓). */
export function filterResolvedMissingKeys(
  missing: string[],
  draft: OrderDraft,
): string[] {
  return missing.filter(key => !isMissingCatalogKeyFilled(key, draft))
}

/** Side-panel control metadata only — labels come from ORDER_FIELD_REGISTRY. */
const FIELD_UI_META: Partial<
  Record<FieldKey, Pick<FieldDef, 'editable' | 'variant'>>
> = {
  total_amount: { variant: 'amount' },
  quantity: { variant: 'number' },
  shipment_method: { variant: 'select' },
  send_datetime: { variant: 'datetime' },
  order_status: { variant: 'order_status' },
  pay_status: { variant: 'select' },
}

/** Build a form row definition; label is always read from the canonical registry. */
export function buildFieldDef(key: FieldKey): FieldDef {
  const { label, editable } = getRegistryEntry(key)
  const ui = FIELD_UI_META[key]
  return {
    key,
    label,
    editable: ui?.editable ?? editable,
    variant: ui?.variant,
  }
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

/** True when pickup/delivery date is missing (time is optional; defaults to 00:00). */
export function isSendDatetimeMissing(form: FormState): boolean {
  return !form.send_datetime_date.trim()
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

/**
 * Formal-order PATCH: nullable fields may send null; NOT NULL fields (item,
 * total_amount) revert to the loaded order snapshot when the user clears them.
 */
export function formStateToOrderPatchForOrder(form: FormState, order: Order) {
  const patch = formStateToOrderPatch(form)
  const total = Number.parseFloat(form.total_amount)
  if (!form.item.trim()) {
    patch.item = order.item
  }
  if (!Number.isFinite(total)) {
    patch.total_amount = order.total_amount
  }
  return patch
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
  /** True when LLM changed this field in the latest organize/suggest. */
  aiChanged?: boolean
}

export function FormRow({
  field,
  isEditing,
  form,
  setField,
  display,
  missing,
  aiChanged = false,
}: FormRowProps) {
  const labelClasses = 'w-[110px] flex-shrink-0 font-bold font-["Noto_Sans_TC",sans-serif] text-base text-black/[0.87]'
  const showAiHighlight = aiChanged && !missing

  return (
    <div className="flex min-h-8 items-center gap-2">
      <div className={labelClasses}>{field.label}</div>
      <div className="flex-1">
        {isEditing ? (
          renderEditor(field, form, setField, missing, showAiHighlight)
        ) : field.variant === 'order_status' && field.editable ? (
          <OrderStatusBadge status={normalizeOrderStatus(form.order_status)} />
        ) : (
          <span
            className={cn(
              "font-['Noto_Sans_TC',sans-serif] text-base text-black",
              showAiHighlight ? AI_CHANGED_VALUE_CLASS : 'font-bold',
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

/** Dropdown select for order status in edit mode. */
export function OrderStatusBlockPicker({
  value,
  onChange,
}: {
  value: OrderStatus
  onChange: (status: OrderStatus) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition',
            "font-['Noto_Sans_TC',sans-serif]",
            orderStatusBadgeClasses(value),
            'hover:opacity-90 active:scale-95',
          )}
        >
          {orderStatusLabel(value)}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-2">
        <ul className="flex flex-col gap-1">
          {ORDER_STATUS_OPTIONS.map(option => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => { onChange(option.value); setOpen(false) }}
                className={cn(
                  'inline-flex w-full h-8 items-center justify-center rounded-lg px-3 text-sm font-bold transition',
                  "font-['Noto_Sans_TC',sans-serif]",
                  orderStatusBadgeClasses(option.value),
                  option.value === value ? 'ring-2 ring-[#6168FC] ring-offset-1' : 'opacity-75 hover:opacity-100',
                )}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function renderEditor(
  field: FieldDef,
  form: FormState,
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void,
  missing: boolean,
  aiChanged: boolean,
) {
  const emptyHint = missing ? '此欄位不可為空' : undefined
  const inputClasses = cn(
    'w-full rounded-md border-[1.5px] border-[#e0e3ed] bg-[#fafbff] px-3 py-2 text-[15px] text-black outline-none transition',
    "font-['Noto_Sans_TC',sans-serif]",
    'focus:border-[#6168FC] focus:shadow-[0_0_0_2px_#e4e7ff]',
    missing && 'border-red-500 bg-red-50 placeholder:text-red-400 focus:shadow-[0_0_0_2px_rgba(220,53,69,0.25)]',
    aiChanged && !missing && AI_CHANGED_INPUT_CLASS,
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
        placeholder={emptyHint}
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
        placeholder={emptyHint}
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
      placeholder={emptyHint}
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
  aiChanged?: boolean
}

export function DateTimeRow({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
  missing,
  aiChanged = false,
}: DateTimeRowProps) {
  const showAiHighlight = aiChanged && !missing
  const inputClasses = cn(
    'w-full rounded-md border-[1.5px] border-[#e0e3ed] bg-[#fafbff] px-3 py-2 text-[15px] text-black outline-none transition',
    "font-['Noto_Sans_TC',sans-serif]",
    'focus:border-[#6168FC] focus:shadow-[0_0_0_2px_#e4e7ff]',
    missing && 'border-red-500 bg-red-50 focus:shadow-[0_0_0_2px_rgba(220,53,69,0.25)]',
    showAiHighlight && AI_CHANGED_INPUT_CLASS,
  )
  return (
    <>
      <div className="flex min-h-8 items-center gap-2">
        <div className='w-[110px] flex-shrink-0 font-bold font-["Noto_Sans_TC",sans-serif] text-base text-black/[0.87]'>{label}</div>
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
