import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteOrder, fetchOrders, updateOrderStatus } from '@/api/orders'
import type { Order } from '@/types/domain'
import type { OrderStatus } from '@/types/enums'

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

/** Apply a status change to the shared orders query cache. */
function patchOrdersCache(
  orders: Order[] | undefined,
  orderId: number,
  status: OrderStatus,
  updatedOrder?: Order,
): Order[] | undefined {
  if (!orders) return orders
  return orders.map(o => {
    if (o.id !== orderId) return o
    return updatedOrder ?? { ...o, order_status: status }
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      await qc.cancelQueries({ queryKey: ORDERS_QUERY_KEY })

      const previousOrders = qc.getQueryData<Order[]>(ORDERS_QUERY_KEY)
      qc.setQueryData<Order[]>(ORDERS_QUERY_KEY, orders =>
        patchOrdersCache(orders, orderId, status) ?? [],
      )

      return { previousOrders }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousOrders !== undefined) {
        qc.setQueryData(ORDERS_QUERY_KEY, context.previousOrders)
      }
    },
    onSuccess: (updatedOrder, { orderId, status }) => {
      qc.setQueryData<Order[]>(ORDERS_QUERY_KEY, orders =>
        patchOrdersCache(orders, orderId, status, updatedOrder) ?? [],
      )
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
