import { MISSING_KEY_TO_FIELD, type FieldKey } from '@/components/messages/orderDraftForm'

/** Highlight classes for AI-changed field values (read-only). */
export const AI_CHANGED_VALUE_CLASS =
  'rounded-sm bg-[#D8EAFF] px-1 font-bold'

/** Highlight classes for AI-changed inputs (edit mode). */
export const AI_CHANGED_INPUT_CLASS = 'bg-[#D8EAFF] border-[#77B5FF]'

const KNOWN_FIELD_KEYS = new Set<FieldKey>([
  'id',
  'customer_name',
  'customer_phone',
  'item',
  'quantity',
  'total_amount',
  'note',
  'shipment_method',
  'send_datetime',
  'delivery_address',
  'pay_way',
  'pay_status',
  'order_date',
  'order_status',
])

/**
 * Map backend `changed_fields` catalog keys to frontend FieldKey set.
 * Unknown keys are ignored.
 */
export function toHighlightFieldKeys(changedFields: string[]): Set<FieldKey> {
  const keys = new Set<FieldKey>()
  for (const raw of changedFields) {
    const mapped = (MISSING_KEY_TO_FIELD[raw] ?? raw) as FieldKey
    if (KNOWN_FIELD_KEYS.has(mapped)) {
      keys.add(mapped)
    }
  }
  return keys
}
