import type { ChatRoomStage } from '@/types/enums'

const DISPLAY: Record<ChatRoomStage, string> = {
  WELCOME: '歡迎',
  IDLE: '閒置',
  ORDER_CONFIRM: '討論完成',
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

/**
 * Tailwind classes for chat room status badges. Keep palette aligned with the
 * legacy `ChatListWrapper.vue` mapping (note this differs from the OrderTable
 * palette where `prepare` and `wait` are swapped).
 */
const BADGE_CLASSES: Record<ChatRoomStage, string> = {
  WELCOME: 'bg-[#FFCEE7] text-[#FF349A]',
  IDLE: 'bg-[#F0F0F0] text-black/60',
  ORDER_CONFIRM: 'bg-[#EBCDCC] text-[#81386A]',
  WAITING_OWNER: 'bg-[#C5C7FF] text-[#6168FC]',
  BOT_ACTIVE: 'bg-[#D8EAFF] text-[#528DD2]',
}

export function getStatusDisplay(status: string | null | undefined): string {
  if (!status) return ''
  return DISPLAY[status as ChatRoomStage] ?? status
}

export function getStatusClass(status: string | null | undefined): string {
  if (!status) return ''
  return CSS_CLASS[status as ChatRoomStage] ?? ''
}

export function getStatusBadgeClasses(
  status: string | null | undefined,
): string {
  if (!status) return BADGE_CLASSES.IDLE
  return BADGE_CLASSES[status as ChatRoomStage] ?? BADGE_CLASSES.IDLE
}
