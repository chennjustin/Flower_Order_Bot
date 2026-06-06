import {
  getAllFieldKeys,
  getDefaultConfig,
  getRegistryEntry,
  isFieldLockedVisible,
} from '@/config/orderDisplayFields'
import type {
  OrderDisplayConfig,
  OrderFieldConfigItem,
  OrderFieldKey,
} from '@/types/orderDisplay'

/** localStorage key; suffix is store id (Phase 1: single-tenant default). */
export const STORAGE_KEY = 'order-display-config:default'

const VALID_KEYS = new Set<OrderFieldKey>(getAllFieldKeys())

function isOrderFieldKey(value: unknown): value is OrderFieldKey {
  return typeof value === 'string' && VALID_KEYS.has(value as OrderFieldKey)
}

/**
 * Merge parsed config with catalog v1: drop unknown keys, append missing keys,
 * re-number order, and enforce non-hideable fields as visible.
 */
export function mergeWithRegistry(parsed: OrderDisplayConfig): OrderDisplayConfig {
  const defaults = getDefaultConfig()
  const defaultByKey = new Map(defaults.fields.map(f => [f.key, f]))

  const savedByKey = new Map<OrderFieldKey, OrderFieldConfigItem>()
  for (const item of parsed.fields) {
    if (!isOrderFieldKey(item.key)) {
      continue
    }
    savedByKey.set(item.key, {
      key: item.key,
      visible: Boolean(item.visible),
      order: typeof item.order === 'number' ? item.order : 0,
    })
  }

  // Sort known saved keys by saved order, then catalog order as tiebreaker.
  const catalogIndex = new Map(getAllFieldKeys().map((key, index) => [key, index]))
  const knownSavedKeys = [...savedByKey.keys()].sort((a, b) => {
    const orderA = savedByKey.get(a)!.order
    const orderB = savedByKey.get(b)!.order
    if (orderA !== orderB) {
      return orderA - orderB
    }
    return catalogIndex.get(a)! - catalogIndex.get(b)!
  })

  const orderedKeys: OrderFieldKey[] = [...knownSavedKeys]
  for (const key of getAllFieldKeys()) {
    if (!savedByKey.has(key)) {
      orderedKeys.push(key)
    }
  }

  const fields: OrderFieldConfigItem[] = orderedKeys.map((key, index) => {
    const saved = savedByKey.get(key)
    const fallback = defaultByKey.get(key)!
    let visible = saved?.visible ?? fallback.visible
    const entry = getRegistryEntry(key)
    if (entry.hidePolicy === 'never' || isFieldLockedVisible(key)) {
      visible = true
    }
    return { key, visible, order: index }
  })

  return { version: 1, fields }
}

function parseStoredJson(raw: string): OrderDisplayConfig | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') {
      return null
    }
    const record = data as Record<string, unknown>
    if (record.version !== 1 || !Array.isArray(record.fields)) {
      return null
    }
    const fields: OrderFieldConfigItem[] = []
    for (const row of record.fields) {
      if (!row || typeof row !== 'object') {
        continue
      }
      const item = row as Record<string, unknown>
      if (!isOrderFieldKey(item.key)) {
        continue
      }
      fields.push({
        key: item.key,
        visible: Boolean(item.visible),
        order: typeof item.order === 'number' ? item.order : fields.length,
      })
    }
    return { version: 1, fields }
  } catch {
    return null
  }
}

/** Read config from localStorage, or return catalog defaults. */
export function loadConfig(storageKey: string = STORAGE_KEY): OrderDisplayConfig {
  if (typeof window === 'undefined') {
    return getDefaultConfig()
  }
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return getDefaultConfig()
  }
  const parsed = parseStoredJson(raw)
  if (!parsed) {
    return getDefaultConfig()
  }
  return mergeWithRegistry(parsed)
}

/** Persist config; always normalizes before write. */
export function saveConfig(
  config: OrderDisplayConfig,
  storageKey: string = STORAGE_KEY,
): void {
  if (typeof window === 'undefined') {
    return
  }
  const normalized = mergeWithRegistry(config)
  window.localStorage.setItem(storageKey, JSON.stringify(normalized))
}

/** Remove saved config (dev / reset). */
export function clearConfig(storageKey: string = STORAGE_KEY): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(storageKey)
}
