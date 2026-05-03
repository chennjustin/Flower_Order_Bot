import type { StaticStats } from '@/types/models'
import './StatisticsCards.css'

interface StatisticsCardsProps {
  /** Aggregated KPI object from GET /stats */
  statics: StaticStats | null | undefined
}

export default function StatisticsCards({ statics }: StatisticsCardsProps) {
  const today = statics?.today_orders ?? '—'
  const pending = statics?.pending_orders ?? '—'
  const monthly = statics?.monthly_income
  const customers = statics?.total_customers ?? '—'

  const cards = [
    { title: '今日訂單', value: today, icon: 'fas fa-calendar' },
    { title: '待處理訂單', value: pending, icon: 'fas fa-comment' },
    { title: '本月營業額', value: `$${monthly ?? '—'}`, icon: 'fas fa-dollar-sign' },
    { title: '顧客總數', value: customers, icon: 'fas fa-users' },
  ]

  return (
    <div className="stat-cards-container">
      {cards.map((card) => (
        <div key={card.title} className="stat-card">
          <div className="stat-card-header">
            <i className={`stat-icon ${card.icon}`} />
            <span className="stat-label">{card.title}</span>
          </div>
          <span className="stat-number">{card.value}</span>
        </div>
      ))}
    </div>
  )
}
