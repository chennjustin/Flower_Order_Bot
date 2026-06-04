import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteOrder, fetchOrders } from '@/api/orders'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { ordersQueryKey, statsQueryKey } from '@/lib/storeQueryKeys'
import type { Order } from '@/types/domain'

/** @deprecated Use ordersQueryKey(storeId) from storeQueryKeys. */
export const ORDERS_QUERY_KEY = ['orders'] as const

export function useOrders() {
  const { storeId, enabled } = useStoreQueryGate()
  return useQuery<Order[]>({
    queryKey: storeId != null ? ordersQueryKey(storeId) : ['orders', 'pending'],
    queryFn: fetchOrders,
    enabled,
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  return useMutation({
    mutationFn: (orderId: number) => deleteOrder(orderId),
    onSuccess: () => {
      if (storeId != null) {
        qc.invalidateQueries({ queryKey: ordersQueryKey(storeId) })
        qc.invalidateQueries({ queryKey: statsQueryKey(storeId) })
      }
    },
  })
}
