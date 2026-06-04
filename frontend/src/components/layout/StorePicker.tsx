import { useStore } from '@/context/StoreContext'

/**
 * Staff store selector; writes active-store-id and drives X-Store-Id on API calls.
 */
export default function StorePicker() {
  const { stores, currentStoreId, setCurrentStoreId, loading, error } = useStore()

  if (loading) {
    return (
      <span className="text-sm text-black/60" aria-live="polite">
        載入店家…
      </span>
    )
  }

  if (error) {
    return (
      <span className="max-w-[200px] truncate text-sm text-red-600" title={error}>
        無法載入店家
      </span>
    )
  }

  if (stores.length === 0) {
    return <span className="text-sm text-black/60">尚無店家</span>
  }

  return (
    <label className="flex items-center gap-2 text-sm text-black/80">
      <span className="sr-only">目前店家</span>
      <select
        value={currentStoreId ?? ''}
        onChange={e => setCurrentStoreId(Number(e.target.value))}
        className="max-w-[180px] truncate rounded-md border border-black/20 bg-white px-2 py-1 text-sm shadow-sm focus:border-[#6168FC] focus:outline-none focus:ring-1 focus:ring-[#6168FC]"
        aria-label="選擇目前店家"
      >
        {stores.map(store => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  )
}
