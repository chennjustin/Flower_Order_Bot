import StatisticsCards from '@/components/stats/StatisticsCards'
import { useStats } from '@/hooks/useStats'

export default function StatsPage() {
  const { data, isLoading, error } = useStats()

  return (
    <div className="px-6 pt-20 pb-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">統計資料</h1>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          無法載入統計資料：{(error as Error).message}
        </div>
      )}
      {isLoading && !data && (
        <div className="text-sm text-gray-500">載入中...</div>
      )}
      <StatisticsCards stats={data} monthlyOrders={0} quickFilter={null} onQuickFilter={() => {}} />
    </div>
  )
}
