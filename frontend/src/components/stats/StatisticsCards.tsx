import type { Stats } from '@/types/domain'

interface StatisticsCardsProps {
  stats: Stats | undefined
}

interface CardSpec {
  title: string
  icon: string
  format: (s: Stats) => string | number
}

const CARDS: CardSpec[] = [
  { title: '今日訂單', icon: 'fas fa-calendar', format: (s) => s.today_orders },
  { title: '待處理訂單', icon: 'fas fa-comment', format: (s) => s.pending_orders },
  {
    title: '本月營業額',
    icon: 'fas fa-dollar-sign',
    format: (s) => `$${s.monthly_income}`,
  },
  { title: '顧客總數', icon: 'fas fa-users', format: (s) => s.total_customers },
]

export default function StatisticsCards({ stats }: StatisticsCardsProps) {
  return (
    <div className="flex h-36 max-w-[948px] flex-row items-center gap-9 bg-transparent">
      {CARDS.map((card) => (
        <div
          key={card.title}
          className="relative h-36 flex-1 cursor-pointer rounded-lg bg-white shadow-[2px_2px_8px_rgba(0,0,0,0.25)] transition-colors duration-200 hover:bg-[#D8EAFF]"
        >
          <i
            className={`${card.icon} absolute top-[27px] left-[38px] h-6 w-6 text-2xl text-brand-primary`}
          />
          <span className="absolute top-[25px] left-[71px] flex h-7 items-center px-2 text-base leading-7 font-bold text-brand-primary">
            {card.title}
          </span>
          <span className="absolute top-[69px] left-[81px] flex h-[50px] w-12 items-center justify-center text-center text-[40px] leading-[50px] font-bold text-brand-primary">
            {stats ? card.format(stats) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
