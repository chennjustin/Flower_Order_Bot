import type { Order } from '@/types/domain'

/** Shared field keys for order form card (view / edit / create). */
export type OrderFormFieldKey =
  | 'id'
  | 'customer_name'
  | 'customer_phone'
  | 'item'
  | 'quantity'
  | 'note'
  | 'shipment_method'
  | 'send_datetime'
  | 'total_amount'
  | 'pay_way'
  | 'pay_status'

export type OrderFormFieldType = 'readonly' | 'text' | 'number' | 'select' | 'datetime' | 'amount'

export interface OrderFormFieldDef {
  key: OrderFormFieldKey
  label: string
  type: OrderFormFieldType
  /** First row (e.g. order id) — no input border in design. */
  plain?: boolean
}

/** Field layout shared by view, edit, and create flows. */
export const ORDER_FORM_FIELDS: readonly OrderFormFieldDef[] = [
  { key: 'id', label: '訂單編號', type: 'readonly', plain: true },
  { key: 'customer_name', label: '姓名', type: 'text' },
  { key: 'customer_phone', label: '電話', type: 'text' },
  { key: 'item', label: '品項', type: 'text' },
  { key: 'quantity', label: '數量', type: 'select' },
  { key: 'note', label: '備註', type: 'text' },
  { key: 'shipment_method', label: '取貨方式', type: 'select' },
  { key: 'send_datetime', label: '取貨時間', type: 'datetime' },
  { key: 'total_amount', label: '金額', type: 'amount' },
  { key: 'pay_way', label: '付款方式', type: 'select' },
  { key: 'pay_status', label: '付款狀態', type: 'select' },
] as const

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

export type OrderFormValues = Record<OrderFormFieldKey, string>

export function orderToFormValues(order: Order): OrderFormValues {
  return {
    id: String(order.id),
    customer_name: order.customer_name ?? '',
    customer_phone: order.customer_phone ?? '',
    item: order.item ?? '',
    quantity: String(order.quantity ?? ''),
    note: order.note ?? '',
    shipment_method: order.shipment_method ?? '',
    send_datetime: order.send_datetime ?? '',
    total_amount: String(order.total_amount ?? ''),
    pay_way: order.pay_way ?? '',
    pay_status: '',
  }
}
