import { ShoppingBag, MessageCircle, BarChart2, DollarSign } from 'lucide-react'
import type { Stats } from '@/types/domain'
import { cn } from '@/lib/utils'

type QuickFilter = 'today' | 'pending' | null

interface StatisticsCardsProps {
  stats: Stats | undefined
  monthlyOrders: number
  quickFilter: QuickFilter
  onQuickFilter: (f: QuickFilter) => void
}

interface CardContentProps {
  icon: React.ReactNode
  title: string
  value: React.ReactNode
}

function CardContent({ icon, title, value }: CardContentProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-3 py-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-base font-bold tracking-[2px] text-brand-primary md:text-xl">
          {title}
        </span>
      </div>
      <span className="text-[32px] font-bold leading-tight text-brand-primary md:text-[40px]">
        {value}
      </span>
    </div>
  )
}

export default function StatisticsCards({
  stats,
  monthlyOrders,
  quickFilter,
  onQuickFilter,
}: StatisticsCardsProps) {
  function toggle(filter: 'today' | 'pending') {
    onQuickFilter(quickFilter === filter ? null : filter)
  }

  const iconCls = 'h-5 w-5 shrink-0 text-brand-primary'
  const baseCls = 'h-[120px] rounded-lg shadow-[2px_2px_8px_rgba(0,0,0,0.25)] transition-colors duration-200 md:h-36'

  return (
    <div className="grid w-full grid-cols-2 gap-4 md:max-w-[948px] md:grid-cols-4 md:gap-9">
      <button
        type="button"
        onClick={() => toggle('today')}
        className={cn(baseCls, 'cursor-pointer', quickFilter === 'today' ? 'bg-[#D8EAFF]' : 'bg-white hover:bg-[#D8EAFF]')}
      >
        <CardContent
          icon={<ShoppingBag className={iconCls} />}
          title="今日製作"
          value={stats ? stats.today_orders : '—'}
        />
      </button>

      <button
        type="button"
        onClick={() => toggle('pending')}
        className={cn(baseCls, 'cursor-pointer', quickFilter === 'pending' ? 'bg-[#D8EAFF]' : 'bg-white hover:bg-[#D8EAFF]')}
      >
        <CardContent
          icon={<MessageCircle className={iconCls} />}
          title="溝通中訂單"
          value={stats ? stats.pending_orders : '—'}
        />
      </button>

      <div className={cn(baseCls, 'bg-white')}>
        <CardContent
          icon={<BarChart2 className={iconCls} />}
          title="本月訂單"
          value={monthlyOrders}
        />
      </div>

      <div className={cn(baseCls, 'bg-white')}>
        <CardContent
          icon={<DollarSign className={iconCls} />}
          title="本月營業額"
          value={stats ? stats.monthly_income : '—'}
        />
      </div>
    </div>
  )
}
