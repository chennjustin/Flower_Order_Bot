import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import StatisticsCards from '@/components/stats/StatisticsCards'
import OrderTable from '@/components/orders/OrderTable'
import { ORDER_COLUMN_NAMES } from '@/constants/orderTable'
import { fetchOrders } from '@/api/orders'
import { fetchStaticData } from '@/api/statics'
import './pageLayout.css'

const emptyStats = {
  today_orders: 0,
  pending_orders: 0,
  monthly_income: 0,
  total_customers: 0,
}

export default function DashboardPage() {
  const qc = useQueryClient()

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  })

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStaticData,
  })

  const error = ordersQuery.error || statsQuery.error
  const loading = ordersQuery.isLoading || statsQuery.isLoading

  const invalidateOrdersStats = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['orders'] })
    void qc.invalidateQueries({ queryKey: ['stats'] })
  }, [qc])

  return (
    <>
      <div className="order-title-wrapper">
        <div className="main-title-bar">
          <span className="main-title">訂單管理平台</span>
        </div>
      </div>
      <div className="page-content">
        {error ? (
          <div className="error-message">無法載入資料，請稍後再試</div>
        ) : (
          <>
            <div className="dashboard-section">
              <StatisticsCards statics={statsQuery.data ?? emptyStats} />
            </div>
            <div className="dashboard-section">
              {loading ? (
                <div className="loading-message">載入中...</div>
              ) : (
                <OrderTable
                  data={ordersQuery.data ?? []}
                  columnName={ORDER_COLUMN_NAMES}
                  onOrderDeleted={invalidateOrdersStats}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
