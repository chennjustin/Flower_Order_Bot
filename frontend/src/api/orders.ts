import { api, API_BASE } from './client'
import type {
  CreateOrderResult,
  Order,
  OrderDraft,
  OrderDraftUpdate,
  OrderListParams,
  OrderListResponse,
  OrderPatchUpdate,
  OrganizeOrderDraftOut,
  OrderSuggestFromChatOut,
} from '@/types/domain'

function buildOrderListQueryParams(params: OrderListParams): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {}
  if (params.page != null) query.page = params.page
  if (params.page_size != null) query.page_size = params.page_size
  if (params.status) query.status = params.status
  if (params.pickup_date) query.pickup_date = params.pickup_date
  if (params.pickup_from) query.pickup_from = params.pickup_from
  if (params.pickup_to) query.pickup_to = params.pickup_to
  if (params.q) query.q = params.q
  if (params.include_cancelled) query.include_cancelled = true
  return query
}

export async function fetchOrdersPage(params: OrderListParams = {}): Promise<OrderListResponse> {
  const { data } = await api.get<OrderListResponse>('/orders', {
    params: buildOrderListQueryParams(params),
  })
  return data
}

export function buildOrdersExportUrl(params: OrderListParams = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(buildOrderListQueryParams(params))) {
    search.set(key, String(value))
  }
  const qs = search.toString()
  return `${API_BASE}/orders/export.csv${qs ? `?${qs}` : ''}`
}

/** All orders for the chat room's customer (includes cancelled). */
export async function fetchOrdersByRoom(roomId: number): Promise<Order[]> {
  const { data } = await api.get<Order[]>(`/orders/room/${roomId}`)
  return data
}

export async function deleteOrder(orderId: number): Promise<boolean> {
  const { data } = await api.delete<boolean>(`/order/${orderId}`)
  return data
}

/** Partial update of a formal order (messages panel edit flow). */
export async function updateOrderById(
  orderId: number,
  patch: OrderPatchUpdate,
): Promise<Order> {
  const { data } = await api.patch<Order>(`/orders/${orderId}`, patch)
  return data
}

/** LLM suggestion from unprocessed chat; does not write the order row. */
export async function suggestOrderFromChat(
  orderId: number,
): Promise<OrderSuggestFromChatOut> {
  const { data } = await api.post<OrderSuggestFromChatOut>(
    `/orders/${orderId}/suggest-from-chat`,
  )
  return data
}

/** Update order status (store manual override). */
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

/** Trigger LLM draft organize; returns draft plus `changed_fields` metadata. */
export async function organizeData(roomId: number): Promise<OrganizeOrderDraftOut> {
  const { data } = await api.patch<OrganizeOrderDraftOut>(`/organize_data/${roomId}`)
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
