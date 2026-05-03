import type { AxiosError } from 'axios'
import { api } from './client'
import type { OrderDraftPayload, OrderRecord } from '@/types/models'

/** Response when creating order from draft may be empty string or list of missing field keys */
export type CreateOrderFromDraftResponse = '' | unknown[]

export async function fetchOrders(): Promise<OrderRecord[]> {
  const res = await api.get<OrderRecord[]>('/orders')
  return res.data
}

export async function createOrderFromDraft(roomId: string): Promise<CreateOrderFromDraftResponse> {
  const res = await api.post<CreateOrderFromDraftResponse>(`/order/${roomId}`)
  return res.data
}

export async function updateOrder(
  roomId: string,
  orderDraft: OrderDraftPayload
): Promise<unknown> {
  const res = await api.patch(`/order/${roomId}`, orderDraft)
  return res.data
}

export async function deleteOrder(orderId: number | string): Promise<unknown> {
  const res = await api.delete(`/order/${orderId}`)
  return res.data
}

export async function fetchOrderDraft(roomId: string): Promise<Record<string, unknown> | null> {
  const res = await api.patch<Record<string, unknown>>(`/organize_data/${roomId}`)
  return res.data ?? null
}

export async function sendOrderDraft(
  roomId: string,
  orderDraft: OrderDraftPayload
): Promise<unknown> {
  const res = await api.patch(`/orderdraft/${roomId}`, orderDraft)
  return res.data
}

export async function readOrderDraft(roomId: string): Promise<Record<string, unknown> | null> {
  const res = await api.get<Record<string, unknown>>(`/orderdraft/${roomId}`)
  return res.data ?? null
}

export async function exportDocx(orderId: number | string): Promise<Blob> {
  try {
    const res = await api.get(`/orders/${orderId}.docx`, { responseType: 'blob' })
    return res.data
  } catch (err: unknown) {
    const axiosErr = err as AxiosError
    console.error('Error exporting docx:', axiosErr.message)
    throw err
  }
}
