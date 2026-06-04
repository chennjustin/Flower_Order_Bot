/** localStorage key for the staff dashboard active store (multi-tenant). */
export const ACTIVE_STORE_STORAGE_KEY = 'active-store-id'

let cachedStoreId: number | null = readStoredStoreId()

function readStoredStoreId(): number | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.localStorage.getItem(ACTIVE_STORE_STORAGE_KEY)
  if (!raw) {
    return null
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Current store id used by axios (in-memory, synced with localStorage). */
export function getActiveStoreId(): number | null {
  return cachedStoreId
}

/** Persist active store and update the in-memory cache for interceptors. */
export function setActiveStoreId(storeId: number | null): void {
  cachedStoreId = storeId
  if (typeof window === 'undefined') {
    return
  }
  if (storeId == null) {
    window.localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, String(storeId))
}
