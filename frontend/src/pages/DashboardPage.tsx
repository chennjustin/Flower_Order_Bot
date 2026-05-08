import StatisticsCards from '@/components/stats/StatisticsCards'
import { useStats } from '@/hooks/useStats'

export default function DashboardPage() {
  const { data, isLoading, error } = useStats()

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">訂單管理平台</h1>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          無法載入統計資料：{(error as Error).message}
        </div>
      )}
      {isLoading && !data && (
        <div className="text-sm text-gray-500">載入中...</div>
      )}
      <StatisticsCards stats={data} />
      <div className="mt-10 rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        (Order table arrives in Step 5.)
      </div>
    </div>
  )
}
