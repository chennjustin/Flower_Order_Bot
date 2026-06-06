import { useStore } from '@/context/StoreContext'

/** Shows the OAuth-bound store name (single-store mode). */
export default function StorePicker() {
  const { stores, loading, error } = useStore()

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

  const store = stores[0]
  return (
    <span
      className="max-w-[180px] truncate text-sm text-black/80"
      title={store.name}
      aria-label={`目前店家：${store.name}`}
    >
      {store.name}
    </span>
  )
}
