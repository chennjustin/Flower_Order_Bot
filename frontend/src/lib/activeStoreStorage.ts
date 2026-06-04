/** localStorage key for the staff dashboard active store (multi-tenant). */
export const ACTIVE_STORE_STORAGE_KEY = 'active-store-id'

/** Coerce and reject invalid store ids (0, NaN, negative, non-integers). */
function normalizeStoreId(storeId: number | null): number | null {
  if (storeId == null) {
    return null
  }
  const parsed = Number(storeId)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.trunc(parsed)
}

function readStoredStoreId(): number | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(ACTIVE_STORE_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

let cachedStoreId: number | null = readStoredStoreId()

/** Current store id used by axios (in-memory, synced with localStorage). */
export function getActiveStoreId(): number | null {
  return cachedStoreId
}

/** Persist active store and update the in-memory cache for interceptors. */
export function setActiveStoreId(storeId: number | null): void {
  const normalized = normalizeStoreId(storeId)
  cachedStoreId = normalized
  if (typeof window === 'undefined') {
    return
  }
  try {
    if (normalized == null) {
      window.localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, String(normalized))
  } catch {
    // Quota or security errors: keep in-memory cache only.
  }
}
