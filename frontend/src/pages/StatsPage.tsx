import StatisticsCards from '@/components/stats/StatisticsCards'
import PageHeader from '@/components/layout/PageHeader'
import { useStats } from '@/hooks/useStats'

export default function StatsPage() {
  const { data, isLoading, error } = useStats()
  const inProgressOrders = data?.in_progress_orders ?? 0

  return (
    <>
      <PageHeader title="統計資料" />
      <div className="mx-auto max-w-[1280px] px-2 pt-[160px]">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            無法載入統計資料：{(error as Error).message}
          </div>
        )}
        {isLoading && !data && (
          <div className="text-sm text-gray-500">載入中...</div>
        )}
        <div className="flex justify-center">
          <div className="w-full max-w-[948px]">
            <StatisticsCards
              stats={data}
              inProgressOrders={inProgressOrders}
              quickFilter={null}
              onQuickFilter={() => {}}
            />
          </div>
        </div>
      </div>
    </>
  )
}
