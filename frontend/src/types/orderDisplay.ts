/**
 * Order display field keys — canonical registry identifiers (v1 catalog).
 * Used by the field-settings page and, in later phases, list/draft/CSV/DOCX.
 */
export type OrderFieldKey =
  | 'id'
  | 'customer_name'
  | 'customer_phone'
  | 'item'
  | 'quantity'
  | 'note'
  | 'shipment_method'
  | 'send_datetime'
  | 'total_amount'
  | 'pay_way'
  | 'pay_status'
  | 'delivery_address'
  | 'order_date'
  | 'order_status'

/** Whether a shop may hide the field in display settings. */
export type HidePolicy = 'never' | 'optional'

/** One row in persisted / draft display config (order = display sequence). */
export interface OrderFieldConfigItem {
  key: OrderFieldKey
  visible: boolean
  order: number
}

/** Persisted per-store display config (Phase 1: localStorage). */
export interface OrderDisplayConfig {
  version: 1
  fields: OrderFieldConfigItem[]
}
