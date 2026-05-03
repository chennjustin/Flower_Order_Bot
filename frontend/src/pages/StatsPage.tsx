import { useQuery } from '@tanstack/react-query'
import StatisticsCards from '@/components/stats/StatisticsCards'
import { fetchStaticData } from '@/api/statics'
import './pageLayout.css'

const emptyStats = {
  today_orders: 0,
  pending_orders: 0,
  monthly_income: 0,
  total_customers: 0,
}

export default function StatsPage() {
  const q = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStaticData,
  })

  return (
    <>
      <div className="order-title-wrapper">
        <div className="main-title-bar">
          <span className="main-title">統計數據</span>
        </div>
      </div>
      <div className="page-content">
        <StatisticsCards statics={q.data ?? emptyStats} />
      </div>
    </>
  )
}
