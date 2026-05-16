import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isFieldLockedVisible } from '@/config/orderDisplayFields'
import { loadConfig, mergeWithRegistry, saveConfig } from '@/lib/orderDisplayStorage'
import type { OrderDisplayConfig, OrderFieldConfigItem, OrderFieldKey } from '@/types/orderDisplay'

function cloneConfig(config: OrderDisplayConfig): OrderDisplayConfig {
  return {
    version: 1,
    fields: config.fields.map(field => ({ ...field })),
  }
}

function sortFieldsByOrder(fields: OrderFieldConfigItem[]): OrderFieldConfigItem[] {
  return [...fields].sort((a, b) => a.order - b.order)
}

function configsEqual(a: OrderDisplayConfig, b: OrderDisplayConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function reorderFields(
  fields: OrderFieldConfigItem[],
  fromIndex: number,
  toIndex: number,
): OrderFieldConfigItem[] {
  const sorted = sortFieldsByOrder(fields)
  if (fromIndex < 0 || fromIndex >= sorted.length || toIndex < 0 || toIndex >= sorted.length) {
    return sorted.map((field, index) => ({ ...field, order: index }))
  }
  const next = [...sorted]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next.map((field, index) => ({ ...field, order: index }))
}

export interface OrderDisplayConfigContextValue {
  /** Last persisted config (normalized). */
  savedConfig: OrderDisplayConfig
  /** In-progress edits on the settings page. */
  draftConfig: OrderDisplayConfig
  hasChanges: boolean
  /** Draft fields sorted by `order` (for list / preview). */
  sortedDraftFields: OrderFieldConfigItem[]
  toggleVisible: (key: OrderFieldKey) => void
  reorder: (fromIndex: number, toIndex: number) => void
  resetDraft: () => void
  save: () => void
}

const OrderDisplayConfigContext = createContext<OrderDisplayConfigContextValue | null>(null)

interface OrderDisplayConfigProviderProps {
  children: ReactNode
}

export function OrderDisplayConfigProvider({ children }: OrderDisplayConfigProviderProps) {
  const [savedConfig, setSavedConfig] = useState<OrderDisplayConfig>(() =>
    mergeWithRegistry(loadConfig()),
  )
  const [draftConfig, setDraftConfig] = useState<OrderDisplayConfig>(() => cloneConfig(savedConfig))

  const hasChanges = useMemo(
    () => !configsEqual(savedConfig, draftConfig),
    [savedConfig, draftConfig],
  )

  const sortedDraftFields = useMemo(
    () => sortFieldsByOrder(draftConfig.fields),
    [draftConfig.fields],
  )

  const toggleVisible = useCallback((key: OrderFieldKey) => {
    if (isFieldLockedVisible(key)) {
      return
    }
    setDraftConfig(prev => ({
      version: 1,
      fields: prev.fields.map(field =>
        field.key === key ? { ...field, visible: !field.visible } : field,
      ),
    }))
  }, [])

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setDraftConfig(prev => ({
      version: 1,
      fields: reorderFields(prev.fields, fromIndex, toIndex),
    }))
  }, [])

  const resetDraft = useCallback(() => {
    setDraftConfig(cloneConfig(savedConfig))
  }, [savedConfig])

  const save = useCallback(() => {
    const normalized = mergeWithRegistry(draftConfig)
    saveConfig(normalized)
    setSavedConfig(normalized)
    setDraftConfig(cloneConfig(normalized))
  }, [draftConfig])

  const value = useMemo<OrderDisplayConfigContextValue>(
    () => ({
      savedConfig,
      draftConfig,
      hasChanges,
      sortedDraftFields,
      toggleVisible,
      reorder,
      resetDraft,
      save,
    }),
    [
      savedConfig,
      draftConfig,
      hasChanges,
      sortedDraftFields,
      toggleVisible,
      reorder,
      resetDraft,
      save,
    ],
  )

  return (
    <OrderDisplayConfigContext.Provider value={value}>
      {children}
    </OrderDisplayConfigContext.Provider>
  )
}

export function useOrderDisplayConfig(): OrderDisplayConfigContextValue {
  const context = useContext(OrderDisplayConfigContext)
  if (!context) {
    throw new Error('useOrderDisplayConfig must be used within OrderDisplayConfigProvider')
  }
  return context
}
