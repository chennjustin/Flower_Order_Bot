import type { ChatRoomStage } from '@/types/enums'

const DISPLAY: Record<ChatRoomStage, string> = {
  WELCOME: '歡迎',
  IDLE: '閒置',
  ORDER_CONFIRM: '等待備貨',
  WAITING_OWNER: '人工溝通',
  BOT_ACTIVE: '自動回覆',
}

const CSS_CLASS: Record<ChatRoomStage, string> = {
  WELCOME: 'welcome',
  IDLE: '',
  ORDER_CONFIRM: 'prepare',
  WAITING_OWNER: 'wait',
  BOT_ACTIVE: 'auto',
}

export function getStatusDisplay(status: string | null | undefined): string {
  if (!status) return ''
  return DISPLAY[status as ChatRoomStage] ?? status
}

export function getStatusClass(status: string | null | undefined): string {
  if (!status) return ''
  return CSS_CLASS[status as ChatRoomStage] ?? ''
}
