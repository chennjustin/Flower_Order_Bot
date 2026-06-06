import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Download, Search, List, Calendar } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { exportDocx } from '@/api/orders'
import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders'
import {
  buildOrderTableColumns,
  formatOrderFieldValue,
  getVisibleFieldItems,
  type OrderTableColumnKey,
} from '@/lib/orderFieldPresentation'
import {
  type OrderFilterTab,
  ORDER_FILTER_TABS,
  ORDER_STATUS_OPTIONS,
  isInProgressOrder,
  isCancelledOrder,
  normalizeOrderStatus,
  orderStatusBadgeClasses,
  orderStatusLabel,
} from '@/utils/orderStatus'
import { toLocalDateKey } from '@/utils/datetime'
import { rowsToCsvBlob } from '@/utils/csv'
import { downloadBlob } from '@/utils/download'
import type { Order } from '@/types/domain'
import type { OrderStatus } from '@/types/enums'
import type { OrderFieldKey } from '@/types/orderDisplay'
import { cn } from '@/lib/utils'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import CalendarView from './CalendarView'
import OrderDatePicker from './OrderDatePicker'
import OrderDetailDialog from './OrderDetailDialog'

type QuickFilter = 'today' | 'in_progress' | null
type ViewMode = 'list' | 'calendar'

interface OrderTableProps {
  quickFilter?: QuickFilter
  onQuickFilterClear?: () => void
  /** Hide the「訂單總覽」heading (e.g. on /order page). */
  showTitle?: boolean
  /** Number of rows per page. Default 20. Dashboard uses 10. */
  pageSize?: number
}

interface NormalizedOrder extends Order {
  display_status: OrderStatus
}

function filterOrdersByPickupDate(rows: NormalizedOrder[], date: Date): NormalizedOrder[] {
  const key = toLocalDateKey(date)
  return rows.filter(r => {
    if (!r.send_datetime) return false
    const d = new Date(r.send_datetime)
    return !Number.isNaN(d.getTime()) && toLocalDateKey(d) === key
  })
}

export default function OrderTable({
  quickFilter,
  onQuickFilterClear,
  showTitle = true,
  pageSize = 20,
}: OrderTableProps) {
  const ordersQuery = useOrders()
  const updateStatusMutation = useUpdateOrderStatus()
  const { savedConfig } = useOrderDisplayConfig()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState<OrderFilterTab>('')
  const [dateFilterActive, setDateFilterActive] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [searchText, setSearchText] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])

  const pendingStatusOrderId =
    updateStatusMutation.isPending ? updateStatusMutation.variables?.orderId ?? null : null

  const effectiveStatusTab: '' | 'in_progress' | 'completed' =
    quickFilter === 'in_progress' || activeTab === 'in_progress'
      ? 'in_progress'
      : activeTab === 'completed'
        ? 'completed'
        : ''

  useEffect(() => {
    if (quickFilter === 'today') {
      setCurrentDate(new Date())
      setDateFilterActive(true)
      setActiveTab('today')
    }
  }, [quickFilter])

  function isTabHighlighted(tab: OrderFilterTab): boolean {
    if (quickFilter === 'today' && tab === 'today') return true
    if (quickFilter === 'in_progress' && tab === 'in_progress') return true
    if (quickFilter) return false
    if (tab === 'today') return activeTab === 'today'
    return activeTab === tab
  }

  const filtered = useMemo<NormalizedOrder[]>(() => {
    let rows: NormalizedOrder[] = orders.map(o => ({
      ...o,
      display_status: normalizeOrderStatus(o.order_status),
    }))

    if (effectiveStatusTab === 'in_progress') {
      rows = rows.filter(r => isInProgressOrder(r.display_status))
    } else if (effectiveStatusTab === 'completed') {
      rows = rows.filter(r => r.display_status === 'COMPLETED')
    } else if (dateFilterActive || quickFilter === 'today') {
      const filterDate = quickFilter === 'today' ? new Date() : currentDate
      rows = filterOrdersByPickupDate(rows, filterDate)
    }

    const showCancelledOrders = activeTab === '' && effectiveStatusTab === ''
    if (!showCancelledOrders) {
      rows = rows.filter(r => !isCancelledOrder(r.display_status))
    }

    const q = searchText.trim().toLowerCase()
    if (q) {
      rows = rows.filter(r =>
        Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)),
      )
    }

    return rows
  }, [orders, effectiveStatusTab, dateFilterActive, currentDate, searchText, activeTab, quickFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    setCurrentPage(1)
  }, [effectiveStatusTab, dateFilterActive, currentDate, searchText, quickFilter])

  const pagedRows = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  )

  const visibleColumns = useMemo(
    () => buildOrderTableColumns(savedConfig),
    [savedConfig],
  )

  function selectTab(value: OrderFilterTab) {
    if (value === 'today') {
      setCurrentDate(new Date())
      setDateFilterActive(true)
      setActiveTab('today')
      onQuickFilterClear?.()
      return
    }
    setActiveTab(value)
    setDateFilterActive(false)
    onQuickFilterClear?.()
  }

  function shiftDate(days: number) {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + days)
    setCurrentDate(next)
    setDateFilterActive(true)
    setActiveTab('')
    onQuickFilterClear?.()
  }

  function selectDate(date: Date) {
    setCurrentDate(date)
    setDateFilterActive(true)
    setActiveTab('')
    onQuickFilterClear?.()
  }

  function handleDownloadCsv() {
    const csvFields = getVisibleFieldItems(savedConfig)
    const headers = csvFields.map(field => field.label)
    const rows = orders.map(order =>
      csvFields.map(field => formatOrderFieldValue(field.key, order)),
    )
    downloadBlob(rowsToCsvBlob(headers, rows), '訂單資料.csv')
  }

  async function handleExportDocx(orderId: number) {
    try {
      const blob = await exportDocx(orderId)
      downloadBlob(blob, `order_${orderId}.docx`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`匯出失敗：${message}`)
    }
  }

  async function handleStatusChange(orderId: number, status: OrderStatus) {
    const order = orders.find(o => o.id === orderId)
    if (order && normalizeOrderStatus(order.order_status) === normalizeOrderStatus(status)) {
      return
    }
    try {
      await updateStatusMutation.mutateAsync({ orderId, status })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`更新訂單狀態失敗：${message}`)
    }
  }

  return (
    <section className="w-full rounded-lg bg-white px-8 py-6 mt-6 mb-8 border-b-[1.5px] border-[#e9e9e9]">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {showTitle && (
          <span className="text-[22px] font-bold tracking-wider whitespace-nowrap text-[#6168FC]">
            訂單總覽
          </span>
        )}

        <div className="flex items-center gap-[9px] rounded-[32px] bg-[#F5F5F5] px-4 py-2">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'flex h-7 items-center gap-2 rounded-[36px] px-2 py-1 text-sm font-bold text-black/60 transition',
              "font-['Noto_Sans_TC',sans-serif]",
              viewMode === 'list' && 'bg-[#C5C7FF]',
            )}
          >
            <List className="h-4 w-4 shrink-0" />
            列表
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={cn(
              'flex h-7 items-center gap-2 rounded-[36px] px-2 py-1 text-sm font-bold text-black/60 transition',
              "font-['Noto_Sans_TC',sans-serif]",
              viewMode === 'calendar' && 'bg-[#C5C7FF]',
            )}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            日曆
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="relative flex h-[46px] w-[360px] min-w-[200px] items-center rounded-[36px] bg-[#D8EAFF] px-6 py-[11px]">
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜尋訂單（姓名、編號等）"
              className="w-full border-0 bg-transparent p-0 text-base leading-[140%] text-black/[0.38] outline-none placeholder:text-black/[0.38] font-['Noto_Sans_TC',sans-serif]"
            />
            <Search className="absolute right-6 top-1/2 h-5 w-5 -translate-y-1/2 text-black/[0.38]" />
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex h-[46px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-[#77B5FF] px-4 py-3 text-white shadow-[2px_2px_2px_rgba(0,0,0,0.25)] transition hover:opacity-90"
          >
            <Download className="h-5 w-5" strokeWidth={2.5} />
            <span className="text-base font-bold leading-[112.5%] font-['Noto_Sans_TC',sans-serif]">
              下載 CSV
            </span>
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex h-10 items-center gap-1 rounded-[36px] bg-[#F7F7F7] px-3 py-1.5">
            {ORDER_FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => selectTab(tab.value)}
                className={cn(
                  'flex h-7 items-center whitespace-nowrap rounded-[36px] px-6 py-[11px] text-sm font-bold leading-[112.5%] text-black/60 transition',
                  "font-['Noto_Sans_TC',sans-serif]",
                  isTabHighlighted(tab.value) && 'bg-[#C5C7FF]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {viewMode === 'list' && (
            <div className="flex h-10 items-center gap-3 rounded-[36px] bg-[#F7F7F7] px-4">
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
                aria-label="前一天"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
              <OrderDatePicker
                value={currentDate}
                onChange={selectDate}
                active={dateFilterActive}
              />
              <button
                type="button"
                onClick={() => shiftDate(1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
                aria-label="後一天"
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            </div>
          )}

          {totalPages > 1 && (
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:enabled:bg-[#C5C7FF] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="上一頁"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
              </button>
              <span className="text-sm font-bold text-black/60 font-['Noto_Sans_TC',sans-serif]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:enabled:bg-[#C5C7FF] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="下一頁"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          )}
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView
          orders={filtered}
          currentDate={currentDate}
          onDateChange={d => {
            setCurrentDate(d)
            setDateFilterActive(false)
          }}
          onOrderClick={setSelectedOrder}
        />
      ) : (
        <div className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto px-2">
            {ordersQuery.error ? (
              <div className="py-10 text-center text-base text-red-600">
                無法載入訂單資料：{(ordersQuery.error as Error).message}
              </div>
            ) : ordersQuery.isLoading && orders.length === 0 ? (
              <div className="py-10 text-center text-base text-[#6168FC]">載入中...</div>
            ) : (
              <>
                <table
                  className="border-separate w-max min-w-full"
                  style={{ borderSpacing: '0 8px' }}
                >
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {visibleColumns.map((col, idx) => (
                        <th
                          key={col.key}
                          style={{ width: col.width }}
                          className={cn(
                            "bg-[#F7F7F7] px-5 py-3 text-left align-middle font-['Noto_Sans_TC',sans-serif] text-base font-bold leading-[140%] text-black/[0.87] whitespace-nowrap relative",
                            'border-y-[0.5px] border-[rgba(175,175,175,0.6)]',
                            idx === 0 && 'rounded-l-xl border-l-[0.5px] border-r-0',
                            idx === visibleColumns.length - 1 &&
                              'rounded-r-xl border-r-[0.5px] border-l-0',
                            idx !== 0 && idx !== visibleColumns.length - 1 && 'border-x-0',
                          )}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map(row => (
                      <tr
                        key={row.id}
                        className="group cursor-pointer bg-white"
                        onClick={() => setSelectedOrder(row)}
                      >
                        {visibleColumns.map((col, idx) => (
                          <td
                            key={col.key}
                            style={{ width: col.width, maxWidth: col.width }}
                            className={cn(
                              "bg-white px-5 py-3 align-middle font-['Noto_Sans_TC',sans-serif] text-base font-bold leading-[140%] text-black/60 break-words transition-colors group-hover:bg-[#f0f6ff]",
                              'border-y-[0.5px] border-[rgba(175,175,175,0.6)]',
                              idx === 0 && 'rounded-l-xl border-l-[0.5px] border-r-0',
                              idx === visibleColumns.length - 1 &&
                                'rounded-r-xl border-r-[0.5px] border-l-0',
                              idx !== 0 && idx !== visibleColumns.length - 1 && 'border-x-0',
                            )}
                          >
                            <Cell
                              column={col.key}
                              row={row}
                              onExport={handleExportDocx}
                              onStatusChange={handleStatusChange}
                              isStatusUpdating={pendingStatusOrderId === row.id}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="py-10 text-center text-[#aaa]">
                    <Search className="mx-auto mb-3 h-8 w-8" strokeWidth={1.5} />
                    <p>找不到符合條件的訂單</p>
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:enabled:bg-[#C5C7FF] disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="上一頁"
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <span className="text-sm font-bold text-black/60 font-['Noto_Sans_TC',sans-serif]">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:enabled:bg-[#C5C7FF] disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="下一頁"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <OrderDetailDialog
        order={selectedOrder}
        open={selectedOrder !== null}
        onOpenChange={open => !open && setSelectedOrder(null)}
      />
    </section>
  )
}

interface CellProps {
  column: OrderTableColumnKey
  row: NormalizedOrder
  onExport: (orderId: number) => void
  onStatusChange: (orderId: number, status: OrderStatus) => void
  isStatusUpdating: boolean
}

function Cell({ column, row, onExport, onStatusChange, isStatusUpdating }: CellProps) {
  if (column === 'export') {
    return (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onExport(row.id)
        }}
        className="flex h-7 w-[60px] max-w-[92px] items-center justify-center rounded-lg border-0 bg-[#77B5FF] px-4 py-1.5 text-sm font-bold text-white transition hover:opacity-80 font-['Noto_Sans_TC',sans-serif]"
      >
        列印
      </button>
    )
  }

  if (column === 'cancel') {
    return (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onStatusChange(row.id, 'CANCELLED')
        }}
        disabled={isStatusUpdating}
        className="flex h-7 w-[60px] max-w-[92px] items-center justify-center rounded-lg border-0 bg-[#AE1914] px-4 py-1.5 text-sm font-bold text-[#EBCDCC] transition hover:opacity-80 disabled:opacity-50 font-['Noto_Sans_TC',sans-serif]"
      >
        刪除
      </button>
    )
  }

  if (column === 'order_status') {
    return (
      <OrderStatusToggle
        orderId={row.id}
        status={row.display_status}
        disabled={isStatusUpdating}
        onChange={onStatusChange}
      />
    )
  }

  return <>{formatOrderFieldValue(column as OrderFieldKey, row)}</>
}

interface OrderStatusToggleProps {
  orderId: number
  status: OrderStatus
  disabled?: boolean
  onChange: (orderId: number, status: OrderStatus) => void
}

function OrderStatusToggle({
  orderId,
  status,
  disabled,
  onChange,
}: OrderStatusToggleProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={e => e.stopPropagation()}
          aria-label="切換訂單狀態"
          className={cn(
            'inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold leading-[112.5%] transition',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-wait disabled:opacity-70',
            orderStatusBadgeClasses(status),
          )}
        >
          {orderStatusLabel(status)}
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-2" onClick={e => e.stopPropagation()}>
        <ul className="flex flex-col gap-1">
          {ORDER_STATUS_OPTIONS.map(option => (
            <li key={option.value}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(orderId, option.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold transition',
                  "font-['Noto_Sans_TC',sans-serif]",
                  option.value === status
                    ? orderStatusBadgeClasses(option.value)
                    : 'text-black/70 hover:bg-black/[0.04]',
                )}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
