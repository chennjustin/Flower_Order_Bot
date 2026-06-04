import { describe, expect, it } from 'vitest'
import { getDefaultConfig } from '@/config/orderDisplayFields'
import type { Order } from '@/types/domain'
import {
  buildOrderTableColumns,
  formatOrderFieldValue,
  formatOrderFormFieldValue,
  getVisibleDraftFields,
  getVisibleFieldItems,
} from '@/lib/orderFieldPresentation'

function sampleOrder(): Order {
  return {
    id: 7,
    customer_name: 'Amy',
    customer_phone: '0912345678',
    order_date: '2026-06-01T10:30:00',
    order_status: 'CONFIRMED',
    pay_way: '轉帳',
    pay_status: 'PENDING',
    total_amount: 1200,
    item: '花束',
    quantity: 1,
    note: '',
    shipment_method: 'DELIVERY',
    send_datetime: '2026-06-02T14:00:00',
    delivery_address: '台北市',
  }
}

describe('getVisibleFieldItems', () => {
  it('uses registry labels for column headers', () => {
    const items = getVisibleFieldItems(getDefaultConfig())
    const customerName = items.find(item => item.key === 'customer_name')
    expect(customerName?.label).toBe('顧客姓名')
  })

  it('omits fields marked not visible in config', () => {
    const config = getDefaultConfig()
    config.fields = config.fields.map(field =>
      field.key === 'pay_status' ? { ...field, visible: false } : field,
    )
    const keys = getVisibleFieldItems(config).map(item => item.key)
    expect(keys).not.toContain('pay_status')
  })

  it('preserves display order from config', () => {
    const config = getDefaultConfig()
    const reversed = [...config.fields].reverse().map((field, index) => ({
      ...field,
      order: index,
    }))
    const keys = getVisibleFieldItems({ version: 1, fields: reversed }).map(
      item => item.key,
    )
    expect(keys[0]).toBe(reversed.find(f => f.visible)?.key)
  })
})

describe('buildOrderTableColumns', () => {
  it('wraps data columns with export and cancel actions', () => {
    const columns = buildOrderTableColumns(getDefaultConfig())
    expect(columns[0]?.key).toBe('export')
    expect(columns[columns.length - 1]?.key).toBe('cancel')
    expect(columns.some(col => col.key === 'customer_name')).toBe(true)
  })
})

describe('formatOrderFieldValue', () => {
  it('formats shipment and payment status for CSV cells', () => {
    const order = sampleOrder()
    expect(formatOrderFieldValue('shipment_method', order)).toBe('外送')
    expect(formatOrderFieldValue('pay_status', order)).toBe('待付款')
  })
})

describe('formatOrderFormFieldValue', () => {
  it('prefixes total amount with NT for detail dialog', () => {
    const formatted = formatOrderFormFieldValue('total_amount', sampleOrder())
    expect(formatted).toContain('NT')
    expect(formatted).toContain('1,200')
  })
})

describe('getVisibleDraftFields', () => {
  it('marks read-only catalog fields as not editable', () => {
    const fields = getVisibleDraftFields(getDefaultConfig())
    const orderDate = fields.find(field => field.key === 'order_date')
    const item = fields.find(field => field.key === 'item')
    expect(orderDate?.editable).toBe(false)
    expect(item?.editable).toBe(true)
  })
})
