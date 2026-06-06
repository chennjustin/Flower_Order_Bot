import { isFieldLockedVisible } from '@/config/orderDisplayFields'
import type { OrderFieldConfigResponse } from '@/api/orderFieldConfig'
import { loadConfig, mergeWithRegistry } from '@/lib/orderDisplayStorage'
import type { OrderDisplayConfig, OrderFieldConfigItem, OrderFieldKey } from '@/types/orderDisplay'

function sortFieldsByOrder(fields: OrderFieldConfigItem[]): OrderFieldConfigItem[] {
  return [...fields].sort((a, b) => a.order - b.order)
}

/** localStorage key scoped to one store. */
export function buildOrderDisplayStorageKey(storeId: number): string {
  return `order-display-config:${storeId}`
}

export function extractVisibleFieldKeys(config: OrderDisplayConfig): OrderFieldKey[] {
  return sortFieldsByOrder(config.fields)
    .filter(field => field.visible)
    .map(field => field.key)
}

/** Full catalog sequence for API field_order (includes hidden fields). */
export function extractFieldOrderKeys(config: OrderDisplayConfig): OrderFieldKey[] {
  return sortFieldsByOrder(config.fields).map(field => field.key)
}

export function applyVisibleFieldsToConfig(
  baseConfig: OrderDisplayConfig,
  visibleFields: OrderFieldKey[],
): OrderDisplayConfig {
  const visibleSet = new Set<OrderFieldKey>(visibleFields)
  const normalizedBase = mergeWithRegistry(baseConfig)
  return {
    version: 1,
    fields: normalizedBase.fields.map(field => ({
      ...field,
      visible: isFieldLockedVisible(field.key) ? true : visibleSet.has(field.key),
    })),
  }
}

export function applyFieldOrderToConfig(
  config: OrderDisplayConfig,
  fieldOrder: OrderFieldKey[],
): OrderDisplayConfig {
  const normalized = mergeWithRegistry(config)
  const byKey = new Map(normalized.fields.map(field => [field.key, field]))
  const ordered: OrderFieldConfigItem[] = []
  const seen = new Set<OrderFieldKey>()

  for (const key of fieldOrder) {
    const field = byKey.get(key)
    if (!field || seen.has(key)) {
      continue
    }
    ordered.push({ ...field })
    seen.add(key)
  }

  for (const field of sortFieldsByOrder(normalized.fields)) {
    if (!seen.has(field.key)) {
      ordered.push({ ...field })
    }
  }

  return {
    version: 1,
    fields: ordered.map((field, index) => ({ ...field, order: index })),
  }
}

/** Build UI config from API + per-store local cache. */
export function buildConfigFromApiResponse(
  remote: OrderFieldConfigResponse,
  storageKey: string,
): OrderDisplayConfig {
  const cached = mergeWithRegistry(loadConfig(storageKey))
  const withVisible = applyVisibleFieldsToConfig(
    cached,
    remote.visible_fields as OrderFieldKey[],
  )
  const withOrder = applyFieldOrderToConfig(withVisible, remote.field_order as OrderFieldKey[])
  return mergeWithRegistry(withOrder)
}
