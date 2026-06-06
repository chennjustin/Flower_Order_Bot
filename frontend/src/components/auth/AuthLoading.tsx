/** Shown while auth session is being restored from storage. */
export default function AuthLoading() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500"
      role="status"
      aria-live="polite"
    >
      載入中…
    </div>
  )
}
