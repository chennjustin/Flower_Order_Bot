import { describe, expect, it } from 'vitest'
import { getDefaultConfig } from '@/config/orderDisplayFields'
import type { OrderFieldConfigResponse } from '@/api/orderFieldConfig'
import {
  applyFieldOrderToConfig,
  buildConfigFromApiResponse,
  buildOrderDisplayStorageKey,
  extractFieldOrderKeys,
  extractVisibleFieldKeys,
} from '@/lib/orderDisplayFromApi'

describe('buildOrderDisplayStorageKey', () => {
  it('scopes localStorage by store id', () => {
    expect(buildOrderDisplayStorageKey(3)).toBe('order-display-config:3')
  })
})

describe('extractFieldOrderKeys', () => {
  it('includes hidden fields in catalog order', () => {
    const config = getDefaultConfig()
    const reversed = [...config.fields].reverse().map((field, index) => ({
      ...field,
      order: index,
    }))
    const keys = extractFieldOrderKeys({ version: 1, fields: reversed })
    expect(keys.length).toBe(config.fields.length)
    expect(keys[0]).toBe(reversed[0]?.key)
  })
})

describe('applyFieldOrderToConfig', () => {
  it('reorders fields to match API field_order', () => {
    const base = getDefaultConfig()
    const reordered = applyFieldOrderToConfig(base, [
      'pay_status',
      'customer_name',
      'id',
    ])
    const keys = reordered.fields
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(f => f.key)
    expect(keys.indexOf('pay_status')).toBeLessThan(keys.indexOf('customer_name'))
  })
})

describe('buildConfigFromApiResponse', () => {
  it('applies visible_fields and field_order from API', () => {
    const remote: OrderFieldConfigResponse = {
      store_id: 1,
      visible_fields: ['customer_name', 'item'],
      field_order: ['item', 'customer_name', 'id'],
      organize_required_fields: [],
      fixed_visible_fields: [],
      optional_visible_fields: [],
      optional_organize_fields: [],
    }
    const config = buildConfigFromApiResponse(
      remote,
      buildOrderDisplayStorageKey(99),
    )
    expect(extractVisibleFieldKeys(config)).toContain('customer_name')
    expect(extractVisibleFieldKeys(config)).not.toContain('pay_status')
    const ordered = extractFieldOrderKeys(config)
    expect(ordered.indexOf('item')).toBeLessThan(ordered.indexOf('customer_name'))
  })
})
