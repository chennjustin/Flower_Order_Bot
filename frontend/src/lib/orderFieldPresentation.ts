import { getRegistryEntry } from '@/config/orderDisplayFields'
import type { Order } from '@/types/domain'
import type { OrderDisplayConfig, OrderFieldKey } from '@/types/orderDisplay'
import { formatCellDateTime } from '@/utils/datetime'
import { normalizeStatus, shipmentLabel, statusText } from '@/utils/orderStatus'

/** One visible data column for list / CSV (label from ORDER_FIELD_REGISTRY). */
export interface VisibleFieldItem {
  key: OrderFieldKey
  label: string
  width?: string
}

/** Non-data table columns (actions). */
export type OrderTableActionKey = 'export' | 'cancel'

export type OrderTableColumnKey = OrderFieldKey | OrderTableActionKey

export interface OrderTableColumnDef {
  key: OrderTableColumnKey
  label: string
  width?: string
}

/** Optional list column widths keyed by catalog field. */
const FIELD_COLUMN_WIDTHS: Partial<Record<OrderFieldKey, string>> = {
  id: '136px',
  order_status: '120px',
  send_datetime: '200px',
  order_date: '200px',
  customer_name: '96px',
  customer_phone: '112px',
  item: '96px',
  quantity: '96px',
  note: '128px',
  shipment_method: '128px',
  delivery_address: '200px',
  total_amount: '96px',
  pay_way: '128px',
  pay_status: '112px',
}

const EXPORT_COLUMN: OrderTableColumnDef = { key: 'export', label: '列印' }
const CANCEL_COLUMN: OrderTableColumnDef = {
  key: 'cancel',
  label: '取消訂單',
  width: '96px',
}

function sortFieldsByOrder<T extends { order: number }>(fields: T[]): T[] {
  return [...fields].sort((a, b) => a.order - b.order)
}

/**
 * Visible catalog fields in display order (registry labels).
 */
export function getVisibleFieldItems(config: OrderDisplayConfig): VisibleFieldItem[] {
  return sortFieldsByOrder(config.fields)
    .filter(field => field.visible)
    .map(field => {
      const { label } = getRegistryEntry(field.key)
      return {
        key: field.key,
        label,
        width: FIELD_COLUMN_WIDTHS[field.key],
      }
    })
}

/**
 * List table columns: export action + visible data fields + cancel action.
 */
export function buildOrderTableColumns(config: OrderDisplayConfig): OrderTableColumnDef[] {
  const dataColumns: OrderTableColumnDef[] = getVisibleFieldItems(config).map(item => ({
    key: item.key,
    label: item.label,
    width: item.width,
  }))
  return [EXPORT_COLUMN, ...dataColumns, CANCEL_COLUMN]
}

function formatPayStatus(order: Order): string {
  if (order.pay_status === 'PAID') return '已付款'
  if (order.pay_status === 'FAILED') return '付款失敗'
  if (order.pay_status === 'REFUNDED') return '已退款'
  return '待付款'
}

/**
 * Plain-text cell value for CSV export and simple table cells.
 */
export function formatOrderFieldValue(key: OrderFieldKey, order: Order): string | number {
  switch (key) {
    case 'id':
      return order.id
    case 'order_status':
      return statusText(normalizeStatus(order.order_status as unknown as string))
    case 'send_datetime':
      return formatCellDateTime(order.send_datetime)
    case 'order_date':
      return formatCellDateTime(order.order_date)
    case 'customer_name':
      return order.customer_name
    case 'customer_phone':
      return order.customer_phone
    case 'item':
      return order.item
    case 'quantity':
      return order.quantity
    case 'note':
      return order.note ?? ''
    case 'shipment_method':
      return shipmentLabel(order.shipment_method)
    case 'delivery_address':
      return order.delivery_address ?? ''
    case 'total_amount':
      return order.total_amount
    case 'pay_way':
      return order.pay_way ?? ''
    case 'pay_status':
      return formatPayStatus(order)
    default: {
      const _exhaustive: never = key
      return String(_exhaustive)
    }
  }
}

export function isOrderTableActionKey(key: OrderTableColumnKey): key is OrderTableActionKey {
  return key === 'export' || key === 'cancel'
}
