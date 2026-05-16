import { useMemo, useState } from 'react'
import OrderTable from '@/components/orders/OrderTable'
import PageHeader from '@/components/layout/PageHeader'
import StatisticsCards from '@/components/stats/StatisticsCards'
import { useStats } from '@/hooks/useStats'
import { useOrders } from '@/hooks/useOrders'

export type QuickFilter = 'today' | 'pending' | null

export default function DashboardPage() {
  const { data, isLoading, error } = useStats()
  const ordersQuery = useOrders()
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)

  const monthlyOrders = useMemo(() => {
    const orders = ordersQuery.data ?? []
    const now = new Date()
    return orders.filter(o => {
      if (!o.order_date) return false
      const d = new Date(o.order_date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
  }, [ordersQuery.data])

  return (
    <>
      <PageHeader title="訂單管理平台" />
      <div className="mx-auto max-w-[1280px] px-7 pt-[160px] md:px-2">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            無法載入統計資料：{(error as Error).message}
          </div>
        )}
        {isLoading && !data && (
          <div className="text-sm text-gray-500">載入中...</div>
        )}
        <StatisticsCards
          stats={data}
          monthlyOrders={monthlyOrders}
          quickFilter={quickFilter}
          onQuickFilter={setQuickFilter}
        />
        <div className="mt-8">
          <OrderTable quickFilter={quickFilter} onQuickFilterClear={() => setQuickFilter(null)} />
        </div>
      </div>
    </>
  )
}
