import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchStores, type StoreListItem } from '@/api/stores'
import { getActiveStoreId, setActiveStoreId } from '@/lib/activeStoreStorage'

export interface StoreContextValue {
  stores: StoreListItem[]
  currentStoreId: number | null
  setCurrentStoreId: (storeId: number) => void
  loading: boolean
  error: string | null
  /** True when stores are loaded and currentStoreId is set. */
  isReady: boolean
}

const StoreContext = createContext<StoreContextValue | null>(null)

function resolveInitialStoreId(
  stores: StoreListItem[],
  storedId: number | null,
): number | null {
  if (stores.length === 0) {
    return null
  }
  if (storedId != null && stores.some(s => s.id === storedId)) {
    return storedId
  }
  return stores[0].id
}

interface StoreProviderProps {
  children: ReactNode
}

export function StoreProvider({ children }: StoreProviderProps) {
  const [stores, setStores] = useState<StoreListItem[]>([])
  const [currentStoreId, setCurrentStoreIdState] = useState<number | null>(() =>
    getActiveStoreId(),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const list = await fetchStores()
        if (cancelled) {
          return
        }
        setStores(list)
        const resolved = resolveInitialStoreId(list, getActiveStoreId())
        setCurrentStoreIdState(resolved)
        setActiveStoreId(resolved)
      } catch (err) {
        if (cancelled) {
          return
        }
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setStores([])
        setCurrentStoreIdState(null)
        setActiveStoreId(null)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const setCurrentStoreId = useCallback((storeId: number) => {
    setCurrentStoreIdState(storeId)
    setActiveStoreId(storeId)
  }, [])

  const isReady = !loading && currentStoreId != null && stores.length > 0

  const value = useMemo<StoreContextValue>(
    () => ({
      stores,
      currentStoreId,
      setCurrentStoreId,
      loading,
      error,
      isReady,
    }),
    [stores, currentStoreId, setCurrentStoreId, loading, error, isReady],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used within StoreProvider')
  }
  return context
}
