import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OrderTable from '@/components/orders/OrderTable'
import PageHeader from '@/components/layout/PageHeader'
import StatisticsCards from '@/components/stats/StatisticsCards'
import { useStats } from '@/hooks/useStats'
import { useStore } from '@/context/StoreContext'

export type QuickFilter = 'today' | 'in_progress' | null

export default function DashboardPage() {
  const navigate = useNavigate()
  const { stores, currentStoreId } = useStore()
  const storeName = stores.find(s => s.id === currentStoreId)?.name ?? '訂單管理平台'
  const { data, isLoading, error } = useStats()
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const inProgressOrders = data?.in_progress_orders ?? 0

  function handleQuickFilter(f: QuickFilter) {
    setQuickFilter(f)
    if (f !== null && window.innerWidth < 768) {
      setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }

  return (
    <>
      <PageHeader title={storeName} />
      <div className="mx-auto max-w-[1280px] pt-[160px] md:px-2">
        <div className="px-4 md:px-0">
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
            inProgressOrders={inProgressOrders}
            quickFilter={quickFilter}
            onQuickFilter={handleQuickFilter}
            mobileTwoCols
          />
        </div>
        <div ref={tableRef} className="mt-6">
          <OrderTable
            quickFilter={quickFilter}
            onQuickFilterClear={() => setQuickFilter(null)}
            pageSize={10}
            onCreateOrder={() => navigate('/orders?create=1')}
          />
        </div>
      </div>
    </>
  )
}
