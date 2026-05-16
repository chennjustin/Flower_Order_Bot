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

export default function StatisticsCards({
  stats,
  monthlyOrders,
  quickFilter,
  onQuickFilter,
}: StatisticsCardsProps) {
  function toggle(filter: 'today' | 'pending') {
    onQuickFilter(quickFilter === filter ? null : filter)
  }

  return (
    <div className="flex h-36 max-w-[948px] flex-row items-center gap-9 bg-transparent">
      <button
        type="button"
        onClick={() => toggle('today')}
        className={cn(
          'relative h-36 flex-1 cursor-pointer rounded-lg shadow-[2px_2px_8px_rgba(0,0,0,0.25)] transition-colors duration-200',
          quickFilter === 'today' ? 'bg-[#D8EAFF]' : 'bg-white hover:bg-[#D8EAFF]',
        )}
      >
        <div className="absolute left-1/2 top-[27px] flex -translate-x-1/2 items-center gap-2 px-2">
          <ShoppingBag className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            今日製作
          </span>
        </div>
        <div className="absolute left-1/2 top-[69px] -translate-x-1/2 -translate-y-0">
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {stats ? stats.today_orders : '—'}
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => toggle('pending')}
        className={cn(
          'relative h-36 flex-1 cursor-pointer rounded-lg shadow-[2px_2px_8px_rgba(0,0,0,0.25)] transition-colors duration-200',
          quickFilter === 'pending' ? 'bg-[#D8EAFF]' : 'bg-white hover:bg-[#D8EAFF]',
        )}
      >
        <div className="absolute left-1/2 top-[27px] flex -translate-x-1/2 items-center gap-2 px-2">
          <MessageCircle className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            溝通中訂單
          </span>
        </div>
        <div className="absolute left-1/2 top-[69px] -translate-x-1/2">
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {stats ? stats.pending_orders : '—'}
          </span>
        </div>
      </button>

      <div className="relative h-36 flex-1 rounded-lg bg-white shadow-[2px_2px_8px_rgba(0,0,0,0.25)]">
        <div className="absolute left-1/2 top-[27px] flex -translate-x-1/2 items-center gap-2 px-2">
          <BarChart2 className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            本月訂單
          </span>
        </div>
        <div className="absolute left-1/2 top-[69px] -translate-x-1/2">
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {monthlyOrders}
          </span>
        </div>
      </div>

      <div className="relative h-36 flex-1 rounded-lg bg-white shadow-[2px_2px_8px_rgba(0,0,0,0.25)]">
        <div className="absolute left-1/2 top-[27px] flex -translate-x-1/2 items-center gap-2 px-2">
          <DollarSign className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            本月營業額
          </span>
        </div>
        <div className="absolute left-1/2 top-[69px] -translate-x-1/2">
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {stats ? stats.monthly_income : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
