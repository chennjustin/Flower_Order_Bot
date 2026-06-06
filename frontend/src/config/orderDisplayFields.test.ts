import { describe, expect, it } from 'vitest'
import { getAllFieldKeys, getDefaultConfig } from '@/config/orderDisplayFields'

const EXPECTED_DEFAULT_ORDER = [
  'id',
  'order_status',
  'customer_name',
  'customer_phone',
  'item',
  'quantity',
  'total_amount',
  'note',
  'send_datetime',
  'shipment_method',
  'pay_way',
  'pay_status',
  'delivery_address',
  'order_date',
] as const

describe('getDefaultConfig', () => {
  it('shows all catalog fields on first use', () => {
    const config = getDefaultConfig()
    expect(config.fields.every(field => field.visible)).toBe(true)
    expect(config.fields).toHaveLength(EXPECTED_DEFAULT_ORDER.length)
  })

  it('uses the canonical default display sequence', () => {
    const config = getDefaultConfig()
    const sorted = [...config.fields].sort((a, b) => a.order - b.order)
    expect(sorted.map(field => field.key)).toEqual([...EXPECTED_DEFAULT_ORDER])
    expect(getAllFieldKeys()).toEqual([...EXPECTED_DEFAULT_ORDER])
  })
  
  it('locks order id so it cannot be hidden', () => {
    const config = getDefaultConfig()
    const idField = config.fields.find(field => field.key === 'id')
    expect(idField?.visible).toBe(true)
  })
})
