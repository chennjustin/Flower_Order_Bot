import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatHeaderDate } from '@/utils/datetime'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

interface OrderDatePickerProps {
  value: Date
  onChange: (date: Date) => void
  active?: boolean
  className?: string
}

export default function OrderDatePicker({ value, onChange, active, className }: OrderDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value))

  function selectDay(day: Date) {
    onChange(day)
    setOpen(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setViewMonth(startOfMonth(value))
  }

  const monthStart = startOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'min-w-[80px] cursor-pointer text-center text-sm leading-[112.5%] whitespace-nowrap',
            "font-['Noto_Sans_TC',sans-serif] font-bold outline-none",
            active ? 'text-[#6168FC]' : 'text-black/40',
            className,
          )}
        >
          {formatHeaderDate(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[280px]">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMonth(m => subMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
            aria-label="上個月"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <span className="text-sm font-bold text-black/80 font-['Noto_Sans_TC',sans-serif]">
            {viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月
          </span>
          <button
            type="button"
            onClick={() => setViewMonth(m => addMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
            aria-label="下個月"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map(day => (
            <div
              key={day}
              className="py-1 text-center text-xs font-bold text-black/40 font-['Noto_Sans_TC',sans-serif]"
            >
              {day}
            </div>
          ))}
          {days.map(day => {
            const inMonth = isSameMonth(day, viewMonth)
            const selected = isSameDay(day, value)
            const today = isToday(day)
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => selectDay(day)}
                className={cn(
                  'flex h-8 w-full items-center justify-center rounded-lg text-sm font-bold transition',
                  "font-['Noto_Sans_TC',sans-serif]",
                  !inMonth && 'text-black/25',
                  inMonth && !selected && 'text-black/70 hover:bg-[#C5C7FF]/60',
                  selected && 'bg-[#6168FC] text-white',
                  today && !selected && 'ring-1 ring-[#6168FC]/40',
                )}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
