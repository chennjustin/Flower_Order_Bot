import { useStore } from '@/context/StoreContext'

/** Gate list/stats queries until StoreContext has resolved the active store. */
export function useStoreQueryGate() {
  const { currentStoreId, isReady } = useStore()
  const enabled = isReady && currentStoreId != null
  return { storeId: currentStoreId, enabled }
}
