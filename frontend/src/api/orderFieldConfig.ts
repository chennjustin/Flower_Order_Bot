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

export async function fetchOrderFieldConfig(
  storeId: number,
): Promise<OrderFieldConfigResponse> {
  const { data } = await api.get<OrderFieldConfigResponse>(
    `/stores/${storeId}/order-field-config`,
  )
  return data
}

export async function updateOrderFieldConfig(
  storeId: number,
  payload: UpdateOrderFieldConfigPayload,
): Promise<OrderFieldConfigResponse> {
  const { data } = await api.put<OrderFieldConfigResponse>(
    `/stores/${storeId}/order-field-config`,
    payload,
  )
  return data
}
