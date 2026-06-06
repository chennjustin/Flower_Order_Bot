import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchOrderFieldConfig,
  updateOrderFieldConfig,
} from '@/api/orderFieldConfig'
import { useAuth } from '@/contexts/AuthContext'
import { getDefaultConfig, isFieldLockedVisible } from '@/config/orderDisplayFields'
import { useStore } from '@/context/StoreContext'
import {
  buildConfigFromApiResponse,
  buildOrderDisplayStorageKey,
  extractFieldOrderKeys,
  extractVisibleFieldKeys,
} from '@/lib/orderDisplayFromApi'
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
  loading: boolean
  savePending: boolean
  loadError: string | null
  hasChanges: boolean
  /** Draft fields sorted by `order` (for list / preview). */
  sortedDraftFields: OrderFieldConfigItem[]
  toggleVisible: (key: OrderFieldKey) => void
  reorder: (fromIndex: number, toIndex: number) => void
  resetDraft: () => void
  save: () => Promise<void>
}

const OrderDisplayConfigContext = createContext<OrderDisplayConfigContextValue | null>(null)

interface OrderDisplayConfigProviderProps {
  children: ReactNode
}

export function OrderDisplayConfigProvider({ children }: OrderDisplayConfigProviderProps) {
  const { session, loading: authLoading } = useAuth()
  const [savedConfig, setSavedConfig] = useState<OrderDisplayConfig>(() =>
    mergeWithRegistry(getDefaultConfig()),
  )
  const [draftConfig, setDraftConfig] = useState<OrderDisplayConfig>(() => cloneConfig(savedConfig))
  const [loading, setLoading] = useState(true)
  const [savePending, setSavePending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!session?.access_token) {
      const local = mergeWithRegistry(loadConfig())
      setSavedConfig(local)
      setDraftConfig(cloneConfig(local))
      setLoadError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const remote = await fetchOrderFieldConfig(currentStoreId)
        if (cancelled) {
          return
        }
        const normalized = buildConfigFromApiResponse(remote, storageKey)
        setSavedConfig(normalized)
        setDraftConfig(cloneConfig(normalized))
        saveConfig(normalized, storageKey)
        setLoadError(null)
      } catch (err) {
        if (cancelled) {
          return
        }
        const message = err instanceof Error ? err.message : String(err)
        const fromLocal = mergeWithRegistry(loadConfig(storageKey))
        setSavedConfig(fromLocal)
        setDraftConfig(cloneConfig(fromLocal))
        setLoadError(`讀取後端欄位設定失敗，已改用本機暫存：${message}`)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, session?.access_token, buildConfigFromVisibleFields])

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

  const save = useCallback(async () => {
    if (currentStoreId == null || storageKey == null) {
      throw new Error('No store selected')
    }
    setSavePending(true)
    const normalized = mergeWithRegistry(draftConfig)
    try {
      const remote = await updateOrderFieldConfig(currentStoreId, {
        visible_fields: extractVisibleFieldKeys(normalized),
        field_order: extractFieldOrderKeys(normalized),
      })
      const applied = buildConfigFromApiResponse(remote, storageKey)
      saveConfig(applied, storageKey)
      setSavedConfig(applied)
      setDraftConfig(cloneConfig(applied))
      setLoadError(null)
    } finally {
      setSavePending(false)
    }
  }, [currentStoreId, draftConfig, storageKey])

  const value = useMemo<OrderDisplayConfigContextValue>(
    () => ({
      savedConfig,
      draftConfig,
      loading,
      savePending,
      loadError,
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
      loading,
      savePending,
      loadError,
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
