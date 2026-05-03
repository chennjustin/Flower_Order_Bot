import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import OrderTable from '@/components/orders/OrderTable'
import { ORDER_COLUMN_NAMES } from '@/constants/orderTable'
import { fetchOrders } from '@/api/orders'
import './pageLayout.css'

export default function OrdersPage() {
  const qc = useQueryClient()
  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  })

  const onDeleted = useCallback(() => void qc.invalidateQueries({ queryKey: ['orders'] }), [qc])

  return (
    <>
      <div className="order-title-wrapper">
        <div className="main-title-bar">
          <span className="main-title">訂單管理</span>
        </div>
      </div>
      <div className="page-content">
        {ordersQuery.error ? (
          <div className="error-message">無法載入訂單資料，請稍後再試</div>
        ) : ordersQuery.isLoading ? (
          <div className="loading-message">載入中...</div>
        ) : (
          <OrderTable
            data={ordersQuery.data ?? []}
            columnName={ORDER_COLUMN_NAMES}
            onOrderDeleted={onDeleted}
          />
        )}
      </div>
    </>
  )
}
