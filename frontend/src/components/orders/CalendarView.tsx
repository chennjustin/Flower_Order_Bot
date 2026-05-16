import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Order } from '@/types/domain'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { normalizeStatus, statusBadgeClasses, statusText } from '@/utils/orderStatus'
import { formatHeaderDate, toLocalDateKey } from '@/utils/datetime'
import { cn } from '@/lib/utils'

interface CalendarViewProps {
  orders: Order[]
  currentDate: Date
  onDateChange: (date: Date) => void
  onOrderClick?: (order: Order) => void
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const
const MAX_VISIBLE_IN_CELL = 3

interface OrderPillProps {
  order: Order
  onSelect: (order: Order) => void
  stopTrigger?: boolean
}

function OrderPill({ order, onSelect, stopTrigger = false }: OrderPillProps) {
  const bucket = normalizeStatus(order.order_status as unknown as string)
  return (
    <button
      type="button"
      onClick={e => {
        if (stopTrigger) e.stopPropagation()
        onSelect(order)
      }}
      className={cn(
        'mb-0.5 box-border block w-full min-w-0 max-w-full shrink-0 self-stretch truncate rounded px-1.5 py-0.5 text-left text-xs font-bold transition hover:opacity-80',
        statusBadgeClasses(bucket),
      )}
      title={`${order.customer_name} - ${statusText(bucket)}`}
    >
      {order.customer_name}
    </button>
  )
}

interface CalendarDayCellProps {
  day: Date
  dayOrders: Order[]
  isToday: boolean
  onOrderClick?: (order: Order) => void
}

function CalendarDayCell({ day, dayOrders, isToday, onOrderClick }: CalendarDayCellProps) {
  const [open, setOpen] = useState(false)
  const hasOverflow = dayOrders.length > MAX_VISIBLE_IN_CELL
  const visibleOrders = dayOrders.slice(0, MAX_VISIBLE_IN_CELL)
  const hiddenCount = dayOrders.length - MAX_VISIBLE_IN_CELL

  function selectOrder(order: Order) {
    onOrderClick?.(order)
    setOpen(false)
  }

  const cellClassName = cn(
    'flex min-h-[90px] w-full min-w-0 flex-col rounded-xl border border-[rgba(175,175,175,0.3)] p-2 text-left transition-colors',
    isToday ? 'bg-[#D8EAFF]' : 'bg-white',
    hasOverflow &&
      'cursor-pointer hover:ring-1 hover:ring-[#6168FC]/40 data-[state=open]:w-full',
  )

  const cellBody = (
    <>
      <div className={cn('mb-1.5 shrink-0 text-sm font-bold', isToday ? 'text-[#6168FC]' : 'text-black/60')}>
        {day.getDate()}
      </div>
      <div className="flex w-full min-w-0 flex-1 flex-col items-stretch overflow-hidden">
        {visibleOrders.map(order => (
          <OrderPill
            key={order.id}
            order={order}
            onSelect={selectOrder}
            stopTrigger={hasOverflow}
          />
        ))}
        {hasOverflow && (
          <span className="mt-auto shrink-0 pt-0.5 text-xs font-bold text-[#6168FC]">
            +{hiddenCount} 筆
          </span>
        )}
      </div>
    </>
  )

  if (!hasOverflow) {
    return <div className={cellClassName}>{cellBody}</div>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className={cellClassName}
          aria-label={`${formatHeaderDate(day)}，共 ${dayOrders.length} 筆訂單`}
        >
          {cellBody}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="z-[1050] w-[220px] border border-[rgba(175,175,175,0.3)] p-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
      >
        <p className="mb-2 px-1 text-sm font-bold text-[#6168FC] font-['Noto_Sans_TC',sans-serif]">
          {formatHeaderDate(day)} · {dayOrders.length} 筆
        </p>
        <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
          {dayOrders.map(order => (
            <OrderPill key={order.id} order={order} onSelect={selectOrder} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function CalendarView({
  orders,
  currentDate,
  onDateChange,
  onOrderClick,
}: CalendarViewProps) {
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
      <div className="mb-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onDateChange(new Date(year, month - 1, 1))}
          aria-label="上個月"
          className="flex h-8 w-8 items-center justify-center rounded-full text-black/45 transition hover:bg-[#F5F5F5] hover:text-[#6168FC]"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <span className="min-w-[120px] text-center text-base font-bold tracking-wider text-[#6168FC]">
          {year} 年 {month + 1} 月
        </span>
        <button
          type="button"
          onClick={() => onDateChange(new Date(year, month + 1, 1))}
          aria-label="下個月"
          className="flex h-8 w-8 items-center justify-center rounded-full text-black/45 transition hover:bg-[#F5F5F5] hover:text-[#6168FC]"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="py-1 text-center text-sm font-bold text-black/40">
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
            <div key={key} className="min-w-0">
              <CalendarDayCell
                day={day}
                dayOrders={dayOrders}
                isToday={isToday}
                onOrderClick={onOrderClick}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
