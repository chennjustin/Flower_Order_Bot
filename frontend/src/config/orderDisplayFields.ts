import type {
  HidePolicy,
  OrderDisplayConfig,
  OrderFieldConfigItem,
  OrderFieldKey,
} from '@/types/orderDisplay'

/** Registry row: metadata for one configurable order field (catalog v1). */
export interface OrderFieldRegistryEntry {
  key: OrderFieldKey
  label: string
  hidePolicy: HidePolicy
  /** Phase 1: shown in settings UI only; does not wire to forms yet. */
  editable: boolean
}

/**
 * Canonical field catalog — fixed 18 keys, no add/remove in settings UI.
 * Order in this array is the default display sequence.
 */
export const ORDER_FIELD_REGISTRY: readonly OrderFieldRegistryEntry[] = [
  { key: 'id', label: '訂單編號', hidePolicy: 'optional', editable: false },
  { key: 'customer_name', label: '顧客姓名', hidePolicy: 'never', editable: true },
  { key: 'customer_phone', label: '顧客電話', hidePolicy: 'optional', editable: true },
  { key: 'receiver_name', label: '收件人姓名', hidePolicy: 'optional', editable: true },
  { key: 'receiver_phone', label: '收件人電話', hidePolicy: 'optional', editable: true },
  { key: 'item', label: '品項', hidePolicy: 'never', editable: true },
  { key: 'quantity', label: '數量', hidePolicy: 'optional', editable: true },
  { key: 'note', label: '備註', hidePolicy: 'optional', editable: true },
  { key: 'card_message', label: '卡片訊息', hidePolicy: 'optional', editable: true },
  { key: 'shipment_method', label: '取貨方式', hidePolicy: 'optional', editable: true },
  { key: 'send_datetime', label: '取貨時間', hidePolicy: 'never', editable: true },
  { key: 'total_amount', label: '總金額', hidePolicy: 'never', editable: true },
  { key: 'pay_way', label: '付款方式', hidePolicy: 'optional', editable: true },
  { key: 'pay_status', label: '付款狀態', hidePolicy: 'optional', editable: true },
  { key: 'receipt_address', label: '收據地址', hidePolicy: 'optional', editable: true },
  { key: 'delivery_address', label: '送貨地址', hidePolicy: 'optional', editable: true },
  { key: 'order_date', label: '訂單日期', hidePolicy: 'optional', editable: false },
  { key: 'order_status', label: '狀態', hidePolicy: 'never', editable: false },
] as const

/** Fields that cannot be hidden (eye toggle disabled). */
export const LOCKED_VISIBLE_KEYS: readonly OrderFieldKey[] = [
  'customer_name',
  'item',
  'total_amount',
  'order_status',
  'send_datetime',
] as const

/** Fields read-only in staff UI (Phase 1: metadata only). */
export const READ_ONLY_KEYS: readonly OrderFieldKey[] = ['id', 'order_date'] as const

/**
 * Phase 2 surface hints — not enforced in Phase 1.
 * Documents where each field will appear once consumers are wired.
 */
export const SURFACE_NOTES: Partial<
  Record<
    OrderFieldKey,
    { list?: boolean; draft?: boolean; csv?: boolean; docx?: boolean; line?: boolean }
  >
> = {
  receiver_name: { list: false, csv: false },
  receiver_phone: { list: false, csv: false },
  card_message: { list: false, csv: false },
  receipt_address: { list: false, csv: false },
  delivery_address: { list: false, csv: false },
  pay_status: { draft: false, csv: false, docx: false },
}

const REGISTRY_BY_KEY: Map<OrderFieldKey, OrderFieldRegistryEntry> = new Map(
  ORDER_FIELD_REGISTRY.map(entry => [entry.key, entry]),
)

export function getRegistryEntry(key: OrderFieldKey): OrderFieldRegistryEntry {
  const entry = REGISTRY_BY_KEY.get(key)
  if (!entry) {
    throw new Error(`Unknown order field key: ${key}`)
  }
  return entry
}

export function isFieldLockedVisible(key: OrderFieldKey): boolean {
  return (LOCKED_VISIBLE_KEYS as readonly string[]).includes(key)
}

export function isFieldReadOnly(key: OrderFieldKey): boolean {
  return (READ_ONLY_KEYS as readonly string[]).includes(key)
}

/** Default visibility for optional fields when no saved config exists. */
function defaultVisibleForEntry(entry: OrderFieldRegistryEntry): boolean {
  if (entry.hidePolicy === 'never') {
    return true
  }
  return true
}

/** Build initial config for a new store / empty localStorage. */
export function getDefaultConfig(): OrderDisplayConfig {
  const fields: OrderFieldConfigItem[] = ORDER_FIELD_REGISTRY.map((entry, index) => ({
    key: entry.key,
    visible: defaultVisibleForEntry(entry),
    order: index,
  }))
  return { version: 1, fields }
}

/** All valid keys in catalog order (for merge/strip logic in Step 3). */
export function getAllFieldKeys(): OrderFieldKey[] {
  return ORDER_FIELD_REGISTRY.map(entry => entry.key)
}
