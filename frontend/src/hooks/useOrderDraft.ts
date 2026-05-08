import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOrderFromDraft,
  fetchOrderDraft,
  organizeData,
  updateOrder,
  updateOrderDraft,
} from '@/api/orders'
import type { CreateOrderResult, OrderDraft, OrderDraftUpdate } from '@/types/domain'

export const orderDraftQueryKey = (roomId: number) =>
  ['chatRooms', roomId, 'orderDraft'] as const

export function useOrderDraft(roomId: number | null, enabled: boolean) {
  return useQuery<OrderDraft | null>({
    queryKey:
      roomId == null
        ? ['chatRooms', 'pending', 'orderDraft']
        : orderDraftQueryKey(roomId),
    queryFn: () => fetchOrderDraft(roomId as number),
    enabled: roomId != null && enabled,
  })
}

export function useUpdateOrderDraft(roomId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: OrderDraftUpdate) => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return updateOrderDraft(roomId, draft)
    },
    onSuccess: () => {
      if (roomId != null) {
        qc.invalidateQueries({ queryKey: orderDraftQueryKey(roomId) })
      }
    },
  })
}

/**
 * Triggers the LLM-driven `organize_data` flow and refreshes the cached draft.
 */
export function useOrganizeData(roomId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return organizeData(roomId)
    },
    onSuccess: data => {
      if (roomId != null) {
        qc.setQueryData(orderDraftQueryKey(roomId), data)
        qc.invalidateQueries({ queryKey: orderDraftQueryKey(roomId) })
      }
    },
  })
}

export function useCreateOrder(roomId: number | null) {
  const qc = useQueryClient()
  return useMutation<CreateOrderResult, Error>({
    mutationFn: () => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return createOrderFromDraft(roomId)
    },
    onSuccess: result => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ['orders'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
      }
    },
  })
}

export function useUpdateOrder(roomId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (roomId == null) return Promise.reject(new Error('No room selected'))
      return updateOrder(roomId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
