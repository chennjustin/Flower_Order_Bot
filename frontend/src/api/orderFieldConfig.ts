import { api } from './client'
import type { OrderFieldKey } from '@/types/orderDisplay'

export interface OrderFieldConfigResponse {
  store_id: number
  visible_fields: OrderFieldKey[]
  organize_required_fields: string[]
  fixed_visible_fields: string[]
  optional_visible_fields: string[]
  optional_organize_fields: string[]
}

interface UpdateOrderFieldConfigPayload {
  visible_fields: OrderFieldKey[]
}

export async function fetchDefaultOrderFieldConfig(): Promise<OrderFieldConfigResponse> {
  const { data } = await api.get<OrderFieldConfigResponse>('/store/order-field-config/default')
  return data
}

export async function updateDefaultOrderFieldConfig(
  visibleFields: OrderFieldKey[],
): Promise<OrderFieldConfigResponse> {
  const payload: UpdateOrderFieldConfigPayload = {
    visible_fields: visibleFields,
  }
  const { data } = await api.put<OrderFieldConfigResponse>(
    '/store/order-field-config/default',
    payload,
  )
  return data
}
