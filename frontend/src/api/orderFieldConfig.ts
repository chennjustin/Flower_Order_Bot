import { api } from './client'
import type { OrderFieldKey } from '@/types/orderDisplay'

export interface OrderFieldConfigResponse {
  store_id: number
  visible_fields: OrderFieldKey[]
  field_order: OrderFieldKey[]
  organize_required_fields: string[]
  fixed_visible_fields: string[]
  optional_visible_fields: string[]
  optional_organize_fields: string[]
}

export interface UpdateOrderFieldConfigPayload {
  visible_fields?: OrderFieldKey[]
  field_order?: OrderFieldKey[]
}

/** Load field config for the OAuth-bound store (no path store_id). */
export async function fetchOrderFieldConfig(): Promise<OrderFieldConfigResponse> {
  const { data } = await api.get<OrderFieldConfigResponse>(
    '/store/order-field-config/default',
  )
  return data
}

/** Persist field config for the OAuth-bound store. */
export async function updateOrderFieldConfig(
  payload: UpdateOrderFieldConfigPayload,
): Promise<OrderFieldConfigResponse> {
  const { data } = await api.put<OrderFieldConfigResponse>(
    '/store/order-field-config/default',
    payload,
  )
  return data
}
