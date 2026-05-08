import { useQuery } from '@tanstack/react-query'
import { fetchStats } from '@/api/stats'

export default function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  })

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-bold text-brand-primary">ChiMei Floral</h1>
        <p className="mt-3 text-sm text-gray-500">
          API + TanStack Query wired. App shell coming in Step 3.
        </p>
        <div className="mt-6 rounded-lg border bg-white p-4 text-left text-sm shadow-sm">
          <div className="font-semibold text-gray-700">Stats probe</div>
          {isLoading && <div className="text-gray-500">loading...</div>}
          {error && (
            <div className="text-red-500">error: {(error as Error).message}</div>
          )}
          {data && (
            <pre className="mt-2 overflow-x-auto text-xs text-gray-600">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
