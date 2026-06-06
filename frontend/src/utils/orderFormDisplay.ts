import type { OrderFormFieldKey } from '@/config/orderFormFields'
import type { Order } from '@/types/domain'
import { formatCellDateTime } from '@/utils/datetime'
import { shipmentLabel } from '@/utils/orderStatus'

export function formatOrderFormDisplayValue(
  key: OrderFormFieldKey,
  order: Order,
): string {
  switch (key) {
    case 'id':
      return String(order.id)
    case 'customer_name':
      return order.customer_name ?? '—'
    case 'customer_phone':
      return order.customer_phone ?? '—'
    case 'item':
      return order.item ?? '—'
    case 'quantity':
      return String(order.quantity ?? '—')
    case 'note':
      return order.note?.trim() ? order.note : '—'
    case 'shipment_method':
      return shipmentLabel(order.shipment_method) || '—'
    case 'send_datetime':
      return formatCellDateTime(order.send_datetime) || '—'
    case 'total_amount':
      return order.total_amount != null
        ? `NT ${order.total_amount.toLocaleString('zh-TW')}`
        : '—'
    case 'pay_way':
      return order.pay_way?.trim() ? order.pay_way : '—'
    case 'pay_status':
      return '—'
    default:
      return '—'
  }
}
