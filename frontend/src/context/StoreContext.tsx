import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMyStore, type StoreListItem } from '@/api/stores'
import { useAuth } from '@/contexts/AuthContext'
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

interface StoreProviderProps {
  children: ReactNode
}

export function StoreProvider({ children }: StoreProviderProps) {
  const { session, loading: authLoading } = useAuth()
  const [stores, setStores] = useState<StoreListItem[]>([])
  const [currentStoreId, setCurrentStoreIdState] = useState<number | null>(() =>
    getActiveStoreId(),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!session?.access_token) {
      setStores([])
      setCurrentStoreIdState(null)
      setActiveStoreId(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const myStore = await fetchMyStore()
        if (cancelled) {
          return
        }
        setStores([myStore])
        setCurrentStoreIdState(myStore.id)
        setActiveStoreId(myStore.id)
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
  }, [authLoading, session?.access_token])

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
