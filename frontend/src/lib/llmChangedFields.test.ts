import { describe, expect, it } from 'vitest'
import { toHighlightFieldKeys } from './llmChangedFields'

describe('toHighlightFieldKeys', () => {
  it('maps catalog keys to FieldKey', () => {
    const keys = toHighlightFieldKeys(['note', 'item_type', 'send_datetime'])
    expect(keys.has('note')).toBe(true)
    expect(keys.has('item')).toBe(true)
    expect(keys.has('send_datetime')).toBe(true)
  })

  it('ignores unknown keys', () => {
    const keys = toHighlightFieldKeys(['note', 'unknown_field'])
    expect(keys.size).toBe(1)
    expect(keys.has('note')).toBe(true)
  })
})
