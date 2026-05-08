import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteOrder, fetchOrders } from '@/api/orders'
import type { Order } from '@/types/domain'

export const ORDERS_QUERY_KEY = ['orders'] as const

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: fetchOrders,
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: number) => deleteOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
