import type { OrderStatus } from '@/types/enums'

/** Store-facing labels for the three actionable order states. */
export const ORDER_STATUS_OPTIONS: ReadonlyArray<{
  value: OrderStatus
  label: string
}> = [
  { value: 'CONFIRMED', label: '尚未製作' },
  { value: 'COMPLETED', label: '訂單完成' },
  { value: 'CANCELLED', label: '訂單取消' },
] as const

/** Filter bucket for the order table tabs (not the same as raw enum). */
export type OrderFilterTab = '' | 'in_progress' | 'completed' | 'today'

export const ORDER_FILTER_TABS: ReadonlyArray<{
  value: OrderFilterTab
  label: string
}> = [
  { value: '', label: '所有訂單' },
  { value: 'in_progress', label: '尚未製作' },
  { value: 'completed', label: '訂單完成' },
  { value: 'today', label: '今日訂單' },
]

/** Normalize backend status into one of the three display buckets. */
export function normalizeOrderStatus(
  status: string | null | undefined,
): OrderStatus {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'CANCELLED':
      return status
    case 'PENDING':
      return 'CONFIRMED'
    default:
      return 'CONFIRMED'
  }
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return '尚未製作'
    case 'COMPLETED':
      return '訂單完成'
    case 'CANCELLED':
      return '訂單取消'
    case 'PENDING':
      return '尚未製作'
  }
}

export function orderStatusBadgeClasses(status: OrderStatus): string {
  switch (status) {
    case 'CONFIRMED':
    case 'PENDING':
      return 'bg-[#C5C7FF] text-[#6168FC]'
    case 'COMPLETED':
      return 'bg-[#D8EAFF] text-[#528DD2]'
    case 'CANCELLED':
      return 'bg-[#EBCDCC] text-[#81386A]'
  }
}

export function isInProgressOrder(status: OrderStatus): boolean {
  return status === 'CONFIRMED' || status === 'PENDING'
}

export function shipmentLabel(method: string | null | undefined): string {
  if (method === 'STORE_PICKUP' || method === 'store_pickup') return '店取'
  if (method === 'DELIVERY' || method === 'delivery') return '外送'
  return method ?? ''
}
