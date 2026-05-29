import { api, API_BASE } from './client'
import type {
  CreateOrderResult,
  Order,
  OrderDraft,
  OrderDraftUpdate,
} from '@/types/domain'

export async function fetchOrders(): Promise<Order[]> {
  const { data } = await api.get<Order[] | null>('/orders')
  return data ?? []
}

export async function deleteOrder(orderId: number): Promise<boolean> {
  const { data } = await api.delete<boolean>(`/order/${orderId}`)
  return data
}

/** Update order status (store manual override). Requires PATCH /order/{id}/status. */
export async function updateOrderStatus(
  orderId: number,
  status: Order['order_status'],
): Promise<Order> {
  const { data } = await api.patch<Order>(`/order/${orderId}/status`, { status })
  return data
}

/**
 * Confirm and create an order from the room's latest draft.
 * Backend returns `[]` on success or an array of missing-field keys.
 */
export async function createOrderFromDraft(
  roomId: number,
): Promise<CreateOrderResult> {
  const { data } = await api.post<string[]>(`/order/${roomId}`)
  const missing = Array.isArray(data) ? data : []
  return { ok: missing.length === 0, missing }
}

export async function updateOrder(roomId: number): Promise<boolean> {
  const { data } = await api.patch<boolean>(`/order/${roomId}`)
  return data
}

export async function fetchOrderDraft(
  roomId: number,
): Promise<OrderDraft | null> {
  const { data } = await api.get<OrderDraft | null>(`/orderdraft/${roomId}`)
  return data ?? null
}

export async function updateOrderDraft(
  roomId: number,
  draft: OrderDraftUpdate,
): Promise<OrderDraft | null> {
  const { data } = await api.patch<OrderDraft | null>(
    `/orderdraft/${roomId}`,
    draft,
  )
  return data ?? null
}

/**
 * Trigger the LLM-driven `organize_data` flow for a room and return the
 * resulting draft.
 */
export async function organizeData(roomId: number): Promise<OrderDraft> {
  const { data } = await api.patch<OrderDraft>(`/organize_data/${roomId}`)
  return data
}

export async function exportDocx(orderId: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/orders/${orderId}.docx`, {
    responseType: 'blob',
  })
  return data
}

/** Direct URL form for `<a href>` style downloads when needed. */
export function exportDocxUrl(orderId: number): string {
  return `${API_BASE}/orders/${orderId}.docx`
}
