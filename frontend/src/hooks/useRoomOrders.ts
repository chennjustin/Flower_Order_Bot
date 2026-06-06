import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOrdersByRoom, suggestOrderFromChat, updateOrderById } from '@/api/orders'
import type { Order, OrderPatchUpdate } from '@/types/domain'
import { ORDERS_QUERY_KEY } from '@/hooks/useOrders'

export const roomOrdersQueryKey = (roomId: number) =>
  ['chatRooms', roomId, 'orders'] as const

export function useRoomOrders(roomId: number | null, enabled: boolean) {
  return useQuery<Order[]>({
    queryKey:
      roomId == null
        ? ['chatRooms', 'pending', 'orders']
        : roomOrdersQueryKey(roomId),
    queryFn: () => fetchOrdersByRoom(roomId as number),
    enabled: enabled && roomId != null,
  })
}

export function useSuggestOrderFromChat() {
  return useMutation({
    mutationFn: (orderId: number) => suggestOrderFromChat(orderId),
  })
}

export function useUpdateRoomOrder(roomId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      patch,
    }: {
      orderId: number
      patch: OrderPatchUpdate
    }) => updateOrderById(orderId, patch),
    onSuccess: updated => {
      if (roomId != null) {
        qc.setQueryData<Order[]>(roomOrdersQueryKey(roomId), orders =>
          orders?.map(o => (o.id === updated.id ? updated : o)) ?? [],
        )
        qc.invalidateQueries({ queryKey: roomOrdersQueryKey(roomId) })
      }
      qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
