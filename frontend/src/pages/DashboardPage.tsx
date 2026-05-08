import OrderTable from '@/components/orders/OrderTable'
import PageHeader from '@/components/layout/PageHeader'
import StatisticsCards from '@/components/stats/StatisticsCards'
import { useStats } from '@/hooks/useStats'

export default function DashboardPage() {
  const { data, isLoading, error } = useStats()

  return (
    <>
      <PageHeader title="訂單管理平台" />
      <div className="mx-auto max-w-[1280px] px-2 pt-[160px]">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            無法載入統計資料：{(error as Error).message}
          </div>
        )}
        {isLoading && !data && (
          <div className="text-sm text-gray-500">載入中...</div>
        )}
        <StatisticsCards stats={data} />
        <div className="mt-8">
          <OrderTable />
        </div>
      </div>
    </>
  )
}
