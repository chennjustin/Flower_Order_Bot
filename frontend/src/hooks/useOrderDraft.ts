import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOrderFromDraft,
  fetchOrderDraft,
  organizeData,
  updateOrder,
  updateOrderDraft,
} from '@/api/orders'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { orderDraftQueryKey, ordersQueryKey, statsQueryKey } from '@/lib/storeQueryKeys'
import type { CreateOrderResult, OrderDraft, OrderDraftUpdate } from '@/types/domain'

export function useOrderDraft(roomId: number | null, enabled: boolean) {
  const { storeId, enabled: storeReady } = useStoreQueryGate()
  const draftEnabled = storeReady && enabled && roomId != null && storeId != null

  return useQuery<OrderDraft | null>({
    queryKey:
      storeId != null && roomId != null
        ? orderDraftQueryKey(storeId, roomId)
        : ['chatRooms', 'pending', 'orderDraft'],
    queryFn: () => fetchOrderDraft(roomId as number),
    enabled: draftEnabled,
  })
}

export function useUpdateOrderDraft(roomId: number | null) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  return useMutation({
    mutationFn: (draft: OrderDraftUpdate) => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return updateOrderDraft(roomId, draft)
    },
    onSuccess: data => {
      if (roomId != null && storeId != null && data != null) {
        qc.setQueryData(orderDraftQueryKey(storeId, roomId), data)
      }
    },
  })
}

/**
 * Triggers the LLM-driven `organize_data` flow and refreshes the cached draft.
 */
export function useOrganizeData(roomId: number | null) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  return useMutation({
    mutationFn: () => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return organizeData(roomId)
    },
    onSuccess: data => {
      if (roomId != null && storeId != null) {
        const key = orderDraftQueryKey(storeId, roomId)
        qc.setQueryData(key, data)
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}

export function useCreateOrder(roomId: number | null) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  return useMutation<CreateOrderResult, Error>({
    mutationFn: () => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return createOrderFromDraft(roomId)
    },
    onSuccess: result => {
      if (result.ok && storeId != null) {
        qc.invalidateQueries({ queryKey: ordersQueryKey(storeId) })
        qc.invalidateQueries({ queryKey: statsQueryKey(storeId) })
      }
    },
  })
}

export function useUpdateOrder(roomId: number | null) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  return useMutation({
    mutationFn: () => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return updateOrder(roomId)
    },
    onSuccess: () => {
      if (storeId != null) {
        qc.invalidateQueries({ queryKey: ordersQueryKey(storeId) })
        qc.invalidateQueries({ queryKey: statsQueryKey(storeId) })
      }
    },
  })
}
