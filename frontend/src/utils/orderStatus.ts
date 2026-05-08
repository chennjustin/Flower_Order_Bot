export type ChatStatus = 'WELCOME' | 'ORDER_CONFIRM' | 'WAITING_OWNER' | 'BOT_ACTIVE'

export const CHAT_STATUS_TABS: ReadonlyArray<{ value: ChatStatus; label: string }> = [
  { value: 'WELCOME', label: '歡迎' },
  { value: 'ORDER_CONFIRM', label: '等待備貨' },
  { value: 'WAITING_OWNER', label: '人工溝通' },
  { value: 'BOT_ACTIVE', label: '自動回覆' },
]

/**
 * Map any backend status string into one of the four UI buckets.
 * Mirrors the legacy Vue mapping; unknown / order-only values fall through to
 * `WAITING_OWNER` so they show up under the 人工溝通 tab.
 */
export function normalizeStatus(status: string | null | undefined): ChatStatus {
  switch (status) {
    case 'WELCOME':
    case 'ORDER_CONFIRM':
    case 'WAITING_OWNER':
    case 'BOT_ACTIVE':
      return status
    case 'MANUAL':
      return 'WAITING_OWNER'
    case 'CONFIRMED':
      return 'ORDER_CONFIRM'
    case 'AUTO':
      return 'BOT_ACTIVE'
    default:
      return 'WAITING_OWNER'
  }
}

export function statusText(status: ChatStatus): string {
  switch (status) {
    case 'WELCOME': return '歡迎'
    case 'ORDER_CONFIRM': return '等待備貨'
    case 'WAITING_OWNER': return '人工溝通'
    case 'BOT_ACTIVE': return '自動回覆'
  }
}

/**
 * Tailwind classes for the status badge bg/text colors. Direct color values
 * keep parity with the Vue palette without introducing more theme tokens.
 */
export function statusBadgeClasses(status: ChatStatus): string {
  switch (status) {
    case 'WELCOME': return 'bg-[#FFCEE7] text-[#FF349A]'
    case 'ORDER_CONFIRM': return 'bg-[#C5C7FF] text-[#6168FC]'
    case 'WAITING_OWNER': return 'bg-[#EBCDCC] text-[#81386A]'
    case 'BOT_ACTIVE': return 'bg-[#D8EAFF] text-[#6168FC]'
  }
}

export function shipmentLabel(method: string | null | undefined): string {
  if (method === 'STORE_PICKUP' || method === 'store_pickup') return '店取'
  if (method === 'DELIVERY' || method === 'delivery') return '外送'
  return method ?? ''
}
