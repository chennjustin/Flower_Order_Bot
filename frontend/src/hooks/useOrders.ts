import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { deleteOrder, fetchOrdersPage, updateOrderStatus } from '@/api/orders'
import { downloadBlob } from '@/utils/download'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { ordersPageQueryKey, statsQueryKey } from '@/lib/storeQueryKeys'
import type { Order, OrderListParams, OrderListResponse } from '@/types/domain'
import type { OrderStatus } from '@/types/enums'

/** @deprecated Use ordersPageQueryKey(storeId, params) from storeQueryKeys. */
export const ORDERS_QUERY_KEY = ['orders'] as const

export function useOrdersPage(params: OrderListParams, enabled = true) {
  const { storeId, enabled: storeReady } = useStoreQueryGate()
  return useQuery<OrderListResponse>({
    queryKey:
      storeId != null
        ? ordersPageQueryKey(storeId, params)
        : ['orders', 'pending', 'page', params],
    queryFn: () => fetchOrdersPage(params),
    enabled: storeReady && enabled,
    placeholderData: previous => previous,
  })
}

export function useDeleteOrder(listParams?: OrderListParams) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  return useMutation({
    mutationFn: (orderId: number) => deleteOrder(orderId),
    onSuccess: () => {
      if (storeId != null) {
        if (listParams) {
          qc.invalidateQueries({ queryKey: ordersPageQueryKey(storeId, listParams) })
        } else {
          qc.invalidateQueries({ queryKey: ['orders', storeId] })
        }
        qc.invalidateQueries({ queryKey: statsQueryKey(storeId) })
      }
    },
  })
}

function patchOrdersPageCache(
  data: OrderListResponse | undefined,
  orderId: number,
  status: OrderStatus,
  updatedOrder?: Order,
): OrderListResponse | undefined {
  if (!data) return data
  return {
    ...data,
    items: data.items.map(o => {
      if (o.id !== orderId) return o
      return updatedOrder ?? { ...o, order_status: status }
    }),
  }
}

export function useUpdateOrderStatus(listParams?: OrderListParams) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  const pageKey =
    storeId != null && listParams
      ? ordersPageQueryKey(storeId, listParams)
      : ORDERS_QUERY_KEY
  const statsKey = storeId != null ? statsQueryKey(storeId) : (['stats'] as const)

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      if (storeId == null || !listParams) return
      await qc.cancelQueries({ queryKey: pageKey })

      const previous = qc.getQueryData<OrderListResponse>(pageKey)
      qc.setQueryData<OrderListResponse>(pageKey, data =>
        patchOrdersPageCache(data, orderId, status) ?? {
          items: [],
          total: 0,
          page: 1,
          page_size: listParams.page_size ?? 20,
        },
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(pageKey, context.previous)
      }
    },
    onSuccess: (updatedOrder, { orderId, status }) => {
      if (storeId != null && listParams) {
        qc.setQueryData<OrderListResponse>(pageKey, data =>
          patchOrdersPageCache(data, orderId, status, updatedOrder) ?? data,
        )
      }
    },
    onSettled: () => {
      if (storeId != null) {
        qc.invalidateQueries({ queryKey: ['orders', storeId] })
        qc.invalidateQueries({ queryKey: statsKey })
      }
    },
  })
}

export async function downloadOrdersCsv(params: OrderListParams) {
  const query: Record<string, string | number | boolean> = {}
  if (params.status) query.status = params.status
  if (params.pickup_date) query.pickup_date = params.pickup_date
  if (params.pickup_from) query.pickup_from = params.pickup_from
  if (params.pickup_to) query.pickup_to = params.pickup_to
  if (params.q) query.q = params.q
  if (params.include_cancelled) query.include_cancelled = true

  const { data } = await api.get<Blob>('/orders/export.csv', {
    params: query,
    responseType: 'blob',
  })
  downloadBlob(data, '訂單資料.csv')
}
