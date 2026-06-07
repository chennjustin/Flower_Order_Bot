import { ShoppingBag, Package, BarChart2, DollarSign } from 'lucide-react'
import type { Stats } from '@/types/domain'
import { cn } from '@/lib/utils'

type QuickFilter = 'today' | 'in_progress' | null

interface StatisticsCardsProps {
  stats: Stats | undefined
  inProgressOrders: number
  quickFilter: QuickFilter
  onQuickFilter: (f: QuickFilter) => void
  /** On mobile, show 2 columns (2×2 grid). Default: 1 column (vertical stack). */
  mobileTwoCols?: boolean
}

export default function StatisticsCards({
  stats,
  inProgressOrders,
  quickFilter,
  onQuickFilter,
  mobileTwoCols = false,
}: StatisticsCardsProps) {
  function toggle(filter: 'today' | 'in_progress') {
    onQuickFilter(quickFilter === filter ? null : filter)
  }

  const cardBase =
    'flex h-36 flex-col items-center justify-center gap-2 rounded-lg shadow-[2px_2px_8px_rgba(0,0,0,0.25)] transition-colors duration-200'

  return (
    <div className={cn(
      'grid w-full gap-4 md:grid-cols-4 md:gap-9',
      mobileTwoCols ? 'grid-cols-2' : 'grid-cols-1',
    )}>
      <button
        type="button"
        onClick={() => toggle('today')}
        className={cn(
          cardBase,
          'cursor-pointer',
          quickFilter === 'today' ? 'bg-[#D8EAFF]' : 'bg-white hover:bg-[#D8EAFF]',
        )}
      >
        <div className="flex items-center gap-2 px-2">
          <ShoppingBag className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            今日製作
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {stats ? stats.today_completed : '—'}
          </span>
          <span className="text-xl font-bold text-brand-primary/40">
            / {stats ? stats.today_orders : '—'}
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => toggle('in_progress')}
        className={cn(
          cardBase,
          'cursor-pointer',
          quickFilter === 'in_progress' ? 'bg-[#D8EAFF]' : 'bg-white hover:bg-[#D8EAFF]',
        )}
      >
        <div className="flex items-center gap-2 px-2">
          <Package className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            尚未製作
          </span>
        </div>
        <div>
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {inProgressOrders}
          </span>
        </div>
      </button>

      <div className={cn(cardBase, 'bg-white')}>
        <div className="flex items-center gap-2 px-2">
          <BarChart2 className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            本月訂單
          </span>
        </div>
        <div>
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {stats ? stats.monthly_orders : '—'}
          </span>
        </div>
      </div>

      <div className={cn(cardBase, 'bg-white')}>
        <div className="flex items-center gap-2 px-2">
          <DollarSign className="h-5 w-5 shrink-0 text-brand-primary" />
          <span className="whitespace-nowrap text-xl font-bold tracking-[2px] text-brand-primary">
            本月營業額
          </span>
        </div>
        <div>
          <span className="text-[40px] font-bold leading-[50px] text-brand-primary">
            {stats ? stats.monthly_income : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
