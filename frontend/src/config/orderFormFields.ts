import { getVisibleFieldItems } from '@/lib/orderFieldPresentation'
import type { Order } from '@/types/domain'
import type { OrderDisplayConfig, OrderFieldKey } from '@/types/orderDisplay'

export type OrderFormFieldType = 'readonly' | 'text' | 'number' | 'select' | 'datetime' | 'amount'

/** View/edit form chrome per catalog key (labels come from ORDER_FIELD_REGISTRY). */
export interface OrderFormFieldUi {
  type: OrderFormFieldType
  /** First row (e.g. order id) — no input border in design. */
  plain?: boolean
}

export const ORDER_FORM_FIELD_UI: Record<OrderFieldKey, OrderFormFieldUi> = {
  id: { type: 'readonly', plain: true },
  customer_name: { type: 'text' },
  customer_phone: { type: 'text' },
  item: { type: 'text' },
  quantity: { type: 'select' },
  note: { type: 'text' },
  shipment_method: { type: 'select' },
  send_datetime: { type: 'datetime' },
  total_amount: { type: 'amount' },
  pay_way: { type: 'select' },
  pay_status: { type: 'select' },
  delivery_address: { type: 'text' },
  order_date: { type: 'readonly' },
  order_status: { type: 'readonly' },
}

export interface OrderFormFieldDef {
  key: OrderFieldKey
  label: string
  type: OrderFormFieldType
  plain?: boolean
}

/**
 * Visible order form rows driven by store field settings + registry labels.
 */
export function getVisibleOrderFormFields(config: OrderDisplayConfig): OrderFormFieldDef[] {
  return getVisibleFieldItems(config).map(item => {
    const ui = ORDER_FORM_FIELD_UI[item.key]
    return {
      key: item.key,
      label: item.label,
      type: ui.type,
      plain: ui.plain,
    }
  })
}

export type OrderFormMode = 'view' | 'edit' | 'create'

export function orderFormTitle(mode: OrderFormMode): string {
  switch (mode) {
    case 'view':
      return '訂單詳情'
    case 'edit':
      return '編輯訂單'
    case 'create':
      return '新增訂單'
  }
}

/** Keys used by the create-order flow (subset of catalog). */
export type OrderFormValuesKey = Exclude<
  OrderFieldKey,
  'id' | 'order_date' | 'order_status' | 'delivery_address'
>

export type OrderFormValues = Record<OrderFormValuesKey, string>

export function orderToFormValues(order: Order): OrderFormValues {
  return {
    customer_name: order.customer_name ?? '',
    customer_phone: order.customer_phone ?? '',
    item: order.item ?? '',
    quantity: String(order.quantity ?? ''),
    note: order.note ?? '',
    shipment_method: order.shipment_method ?? '',
    send_datetime: order.send_datetime ?? '',
    total_amount: String(order.total_amount ?? ''),
    pay_way: order.pay_way ?? '',
    pay_status: order.pay_status ?? '',
  }
}
