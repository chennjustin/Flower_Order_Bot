import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Order } from '@/types/domain'
import { normalizeStatus, statusBadgeClasses, statusText } from '@/utils/orderStatus'
import { toLocalDateKey } from '@/utils/datetime'
import { cn } from '@/lib/utils'

interface CalendarViewProps {
  orders: Order[]
  currentDate: Date
  onDateChange: (date: Date) => void
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

export default function CalendarView({ orders, currentDate, onDateChange }: CalendarViewProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const ordersByDate = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const order of orders) {
      if (!order.send_datetime) continue
      const d = new Date(order.send_datetime)
      if (Number.isNaN(d.getTime())) continue
      const key = toLocalDateKey(d)
      const existing = map.get(key)
      if (existing) existing.push(order)
      else map.set(key, [order])
    }
    return map
  }, [orders])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const totalDays = new Date(year, month + 1, 0).getDate()
    const startOffset = firstDay.getDay()
    const days: (Date | null)[] = Array(startOffset).fill(null)
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d))
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [year, month])

  const todayKey = toLocalDateKey(new Date())

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => onDateChange(new Date(year, month - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={3} />
        </button>
        <span className="min-w-[120px] text-center text-base font-bold tracking-wider text-[#6168FC]">
          {year} 年 {month + 1} 月
        </span>
        <button
          type="button"
          onClick={() => onDateChange(new Date(year, month + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAY_LABELS.map(label => (
          <div
            key={label}
            className="py-1 text-center text-sm font-bold text-black/40"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="min-h-[90px]" />
          const key = toLocalDateKey(day)
          const dayOrders = ordersByDate.get(key) ?? []
          const isToday = key === todayKey

          return (
            <div
              key={key}
              className={cn(
                'min-h-[90px] rounded-xl border border-[rgba(175,175,175,0.3)] p-2 transition-colors',
                isToday ? 'bg-[#D8EAFF]' : 'bg-white',
              )}
            >
              <div
                className={cn(
                  'mb-1.5 text-sm font-bold',
                  isToday ? 'text-[#6168FC]' : 'text-black/60',
                )}
              >
                {day.getDate()}
              </div>
              {dayOrders.slice(0, 3).map(order => {
                const bucket = normalizeStatus(order.order_status as unknown as string)
                return (
                  <div
                    key={order.id}
                    className={cn(
                      'mb-0.5 truncate rounded px-1.5 py-0.5 text-xs font-bold',
                      statusBadgeClasses(bucket),
                    )}
                    title={`${order.customer_name} - ${statusText(bucket)}`}
                  >
                    {order.customer_name}
                  </div>
                )
              })}
              {dayOrders.length > 3 && (
                <div className="text-xs text-black/40">+{dayOrders.length - 3} 筆</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
