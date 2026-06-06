import type { ChatRoomListParams, OrderListParams } from '@/types/domain'

/** React Query keys scoped by active store (multi-tenant staff UI). */

export function ordersQueryKey(storeId: number) {
  return ['orders', storeId] as const
}

export function ordersPageQueryKey(storeId: number, params: OrderListParams) {
  return ['orders', storeId, 'page', params] as const
}

export function chatRoomsQueryKey(storeId: number, filters?: ChatRoomListParams) {
  return [
    'chatRooms',
    storeId,
    filters?.stage ?? 'ALL',
    filters?.q ?? '',
  ] as const
}

export function statsQueryKey(storeId: number) {
  return ['stats', storeId] as const
}

export function roomMessagesQueryKey(storeId: number, roomId: number) {
  return ['chatRooms', storeId, roomId, 'messages'] as const
}

export function orderDraftQueryKey(storeId: number, roomId: number) {
  return ['chatRooms', storeId, roomId, 'orderDraft'] as const
}
