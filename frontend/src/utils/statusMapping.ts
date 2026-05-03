/**
 * Maps backend room lifecycle codes to Traditional Chinese labels for display.
 */

export const statusMapping: Record<string, string> = {
  WELCOME: '歡迎',
  ORDER_CONFIRM: '等待備貨',
  WAITING_OWNER: '人工溝通',
  BOT_ACTIVE: '自動回覆',
}

export function getStatusDisplay(status: string | undefined): string {
  if (!status) return ''
  return statusMapping[status] ?? status
}

/** CSS modifier used by ChatList / ChatHeader (welcome | prepare | wait | auto). */
export function getStatusClass(status: string | undefined): string {
  switch (status) {
    case 'ORDER_CONFIRM':
      return 'prepare'
    case 'WAITING_OWNER':
      return 'wait'
    case 'BOT_ACTIVE':
      return 'auto'
    case 'WELCOME':
      return 'welcome'
    default:
      return ''
  }
}

/**
 * Normalize mixed legacy order-room status codes onto the four canonical values.
 */
export function normalizeOrderStatus(status: string | undefined): string {
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

/** Table badges in OrderTable (matches Vue CSS class names). */
export function orderStatusBadgeClass(status: string | undefined): string {
  const n = normalizeOrderStatus(status)
  const map: Record<string, string> = {
    WELCOME: 'badge-welcome',
    ORDER_CONFIRM: 'badge-prepare',
    WAITING_OWNER: 'badge-wait',
    BOT_ACTIVE: 'badge-auto',
  }
  return map[n] ?? 'badge-wait'
}
