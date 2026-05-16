import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Search, List, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { exportDocx } from '@/api/orders'
import { useDeleteOrder, useOrders } from '@/hooks/useOrders'
import {
  type ChatStatus,
  normalizeStatus,
  shipmentLabel,
  statusBadgeClasses,
  statusText,
} from '@/utils/orderStatus'
import { formatCellDateTime, toLocalDateKey } from '@/utils/datetime'
import { rowsToCsvBlob } from '@/utils/csv'
import { downloadBlob } from '@/utils/download'
import type { Order } from '@/types/domain'
import { cn } from '@/lib/utils'
import CalendarView from './CalendarView'
import OrderDatePicker from './OrderDatePicker'
import OrderDetailDialog from './OrderDetailDialog'

type QuickFilter = 'today' | 'pending' | null
type ViewMode = 'list' | 'calendar'
type FilterTab = '' | 'WAITING_OWNER' | 'today' | 'ORDER_CONFIRM'

interface OrderTableProps {
  quickFilter?: QuickFilter
  onQuickFilterClear?: () => void
  /** Hide the「訂單總覽」heading (e.g. on /order page). */
  showTitle?: boolean
}

type ColumnKey =
  | 'export'
  | 'id'
  | 'status'
  | 'send_datetime'
  | 'customer_name'
  | 'customer_phone'
  | 'item'
  | 'quantity'
  | 'note'
  | 'shipment_method'
  | 'total_amount'
  | 'pay_way'
  | 'pay_status'
  | 'cancel'

interface ColumnDef {
  key: ColumnKey
  label: string
  width?: string
}

const COLUMNS: ColumnDef[] = [
  { key: 'export', label: '列印' },
  { key: 'id', label: '訂單編號', width: '136px' },
  { key: 'status', label: '狀態', width: '120px' },
  { key: 'send_datetime', label: '取貨時間', width: '200px' },
  { key: 'customer_name', label: '姓名', width: '96px' },
  { key: 'customer_phone', label: '電話', width: '112px' },
  { key: 'item', label: '品項', width: '96px' },
  { key: 'quantity', label: '數量', width: '96px' },
  { key: 'note', label: '備註', width: '128px' },
  { key: 'shipment_method', label: '取貨方式', width: '128px' },
  { key: 'total_amount', label: '金額', width: '96px' },
  { key: 'pay_way', label: '付款方式', width: '128px' },
  { key: 'pay_status', label: '付款狀態', width: '112px' },
  { key: 'cancel', label: '取消訂單', width: '96px' },
]

const FILTER_TABS: ReadonlyArray<{ value: FilterTab; label: string }> = [
  { value: '', label: '所有訂單' },
  { value: 'WAITING_OWNER', label: '人工溝通' },
  { value: 'today', label: '今日訂單' },
  { value: 'ORDER_CONFIRM', label: '等待備貨' },
]

interface NormalizedOrder extends Order {
  status_bucket: ChatStatus
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
}: OrderTableProps) {
  const ordersQuery = useOrders()
  const deleteMutation = useDeleteOrder()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState<FilterTab>('')
  const [dateFilterActive, setDateFilterActive] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [searchText, setSearchText] = useState('')
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])

  // Status tab from filter bar or dashboard quick-filter (pending only)
  const effectiveStatusTab: FilterTab =
    quickFilter === 'pending' ? 'WAITING_OWNER' : activeTab

  const isTodayFilter =
    dateFilterActive && toLocalDateKey(currentDate) === toLocalDateKey(new Date())

  useEffect(() => {
    if (quickFilter === 'today') {
      setCurrentDate(new Date())
      setDateFilterActive(true)
      setActiveTab('')
    }
  }, [quickFilter])

  function isTabHighlighted(tab: FilterTab): boolean {
    if (quickFilter === 'today' && tab === 'today') return true
    if (quickFilter === 'pending' && tab === 'WAITING_OWNER') return true
    if (quickFilter) return false
    if (tab === 'today') return isTodayFilter
    if (tab === '') return activeTab === '' && !dateFilterActive
    return activeTab === tab && !dateFilterActive
  }

  const filtered = useMemo<NormalizedOrder[]>(() => {
    let rows: NormalizedOrder[] = orders.map(o => ({
      ...o,
      status_bucket: normalizeStatus(o.order_status as unknown as string),
    }))

    if (effectiveStatusTab === 'WAITING_OWNER') {
      rows = rows.filter(r => r.status_bucket === 'WAITING_OWNER')
    } else if (effectiveStatusTab === 'ORDER_CONFIRM') {
      rows = rows.filter(r => r.status_bucket === 'ORDER_CONFIRM')
    } else if (dateFilterActive || quickFilter === 'today') {
      const filterDate = quickFilter === 'today' ? new Date() : currentDate
      rows = filterOrdersByPickupDate(rows, filterDate)
    }

    const q = searchText.trim().toLowerCase()
    if (q) {
      rows = rows.filter(r =>
        Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)),
      )
    }

    return rows
  }, [orders, effectiveStatusTab, dateFilterActive, currentDate, searchText, quickFilter])

  function selectTab(value: FilterTab) {
    if (value === 'today') {
      setCurrentDate(new Date())
      setDateFilterActive(true)
      setActiveTab('')
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
    const headers = COLUMNS.map(c => c.label)
    const rows = orders.map(o => [
      o.order_status,
      o.id,
      o.order_status,
      o.send_datetime,
      o.customer_name,
      o.customer_phone,
      o.item,
      o.quantity,
      o.note ?? '',
      shipmentLabel(o.shipment_method),
      o.total_amount,
      o.pay_way ?? '',
      '',
      o.id,
    ])
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

  async function confirmDelete() {
    if (pendingDelete == null) return
    const orderId = pendingDelete
    try {
      await deleteMutation.mutateAsync(orderId)
      setPendingDelete(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`取消訂單時發生錯誤：${message}`)
    }
  }

  const viewToggle = (
    <div className="flex shrink-0 items-center gap-[9px] rounded-[32px] bg-[#F5F5F5] px-3 py-2 md:px-4">
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
  )

  const dateNavigator = (className?: string) => (
    <div className={cn('flex h-10 items-center gap-2 rounded-[36px] bg-[#F7F7F7] px-3', className)}>
      <button
        type="button"
        onClick={() => shiftDate(-1)}
        aria-label="前一天"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <OrderDatePicker value={currentDate} onChange={selectDate} active={dateFilterActive} />
      <button
        type="button"
        onClick={() => shiftDate(1)}
        aria-label="後一天"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
    </div>
  )

  const filterTabs = () => (
    <div className="flex w-fit max-w-full shrink-0 self-start items-center gap-1 overflow-x-auto rounded-[36px] bg-[#F7F7F7] px-3 py-1.5">
      {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => selectTab(tab.value)}
            className={cn(
              'flex h-7 shrink-0 items-center whitespace-nowrap rounded-[36px] px-3 py-[11px] text-sm font-bold leading-[112.5%] text-black/60 transition md:px-6',
              "font-['Noto_Sans_TC',sans-serif]",
              isTabHighlighted(tab.value) && 'bg-[#C5C7FF]',
            )}
          >
            {tab.label}
          </button>
      ))}
    </div>
  )

  return (
    <>
      {showTitle && (
        <h2 className="mb-3 text-[20px] font-bold tracking-wider text-[#6168FC] md:hidden">
          訂單總覽
        </h2>
      )}

      <section className="mt-6 mb-8 rounded-lg border-b-[1.5px] border-[#e9e9e9] bg-white px-4 py-4 md:px-8 md:py-6">
        <div className="mb-4 hidden flex-wrap items-center gap-4 md:flex">
          {showTitle && (
            <span className="whitespace-nowrap text-[22px] font-bold tracking-wider text-[#6168FC]">
              訂單總覽
            </span>
          )}
          {viewToggle}
          <div className="ml-auto flex items-center gap-4">
            <div className="relative flex h-[46px] w-[360px] items-center rounded-[36px] bg-[#D8EAFF] px-6 py-[11px]">
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

        <div className="mb-4 hidden items-center gap-2 md:flex">
          {filterTabs()}
          {dateNavigator('shrink-0 gap-3 px-4')}
        </div>

        <div className="mb-4 flex flex-col items-start gap-3 md:hidden">
          <div className="flex w-full flex-nowrap items-center justify-between gap-2">
            {viewToggle}
            {dateNavigator('min-w-0 shrink gap-1.5 px-2')}
          </div>
          <div className="relative flex h-[46px] w-full items-center rounded-[36px] bg-[#D8EAFF] px-5 py-[11px]">
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜尋訂單"
              className="w-full border-0 bg-transparent p-0 text-base leading-[140%] text-black/[0.38] outline-none placeholder:text-black/[0.38] font-['Noto_Sans_TC',sans-serif]"
            />
            <Search className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-black/[0.38]" />
          </div>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex h-10 w-fit items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-[#77B5FF] px-4 py-2 text-white shadow-[2px_2px_2px_rgba(0,0,0,0.25)] transition hover:opacity-90"
          >
            <Download className="h-4 w-4" strokeWidth={2.5} />
            <span className="text-sm font-bold leading-[112.5%] font-['Noto_Sans_TC',sans-serif]">
              下載 CSV
            </span>
          </button>
          {filterTabs()}
        </div>

      {/* Content */}
      {viewMode === 'calendar' ? (
        <CalendarView
          orders={orders}
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
                      {COLUMNS.map((col, idx) => (
                        <th
                          key={col.key}
                          style={{ width: col.width }}
                          className={cn(
                            "bg-[#F7F7F7] px-5 py-3 text-left align-middle font-['Noto_Sans_TC',sans-serif] text-base font-bold leading-[140%] text-black/[0.87] whitespace-nowrap relative",
                            'border-y-[0.5px] border-[rgba(175,175,175,0.6)]',
                            idx === 0 && 'rounded-l-xl border-l-[0.5px] border-r-0',
                            idx === COLUMNS.length - 1 && 'rounded-r-xl border-r-[0.5px] border-l-0',
                            idx !== 0 && idx !== COLUMNS.length - 1 && 'border-x-0',
                          )}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => (
                      <tr
                        key={row.id}
                        className="group cursor-pointer bg-white"
                        onClick={() => setSelectedOrder(row)}
                      >
                        {COLUMNS.map((col, idx) => (
                          <td
                            key={col.key}
                            style={{ width: col.width, maxWidth: col.width }}
                            className={cn(
                              "bg-white px-5 py-3 align-middle font-['Noto_Sans_TC',sans-serif] text-base font-bold leading-[140%] text-black/60 break-words transition-colors group-hover:bg-[#f0f6ff]",
                              'border-y-[0.5px] border-[rgba(175,175,175,0.6)]',
                              idx === 0 && 'rounded-l-xl border-l-[0.5px] border-r-0',
                              idx === COLUMNS.length - 1 && 'rounded-r-xl border-r-[0.5px] border-l-0',
                              idx !== 0 && idx !== COLUMNS.length - 1 && 'border-x-0',
                            )}
                          >
                            <Cell column={col.key} row={row} onExport={handleExportDocx} onDelete={setPendingDelete} />
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

      <Dialog open={pendingDelete !== null} onOpenChange={open => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確定要刪除此訂單？</DialogTitle>
            <DialogDescription>
              訂單編號 #{pendingDelete} 將被取消，此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="h-9 rounded-md border border-black/10 bg-white px-4 text-sm font-bold text-black/70 transition hover:bg-black/5"
              >
                取消
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="h-9 rounded-md bg-[#AE1914] px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {deleteMutation.isPending ? '刪除中…' : '確認刪除'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
    </>
  )
}

interface CellProps {
  column: ColumnKey
  row: NormalizedOrder
  onExport: (orderId: number) => void
  onDelete: (orderId: number) => void
}

function Cell({ column, row, onExport, onDelete }: CellProps) {
  switch (column) {
    case 'export':
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
    case 'cancel':
      return (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDelete(row.id)
          }}
          className="flex h-7 w-[60px] max-w-[92px] items-center justify-center rounded-lg border-0 bg-[#AE1914] px-4 py-1.5 text-sm font-bold text-[#EBCDCC] transition hover:opacity-80 font-['Noto_Sans_TC',sans-serif]"
        >
          刪除
        </button>
      )
    case 'id':
      return <>{row.id}</>
    case 'status':
      return (
        <span
          className={cn(
            'inline-flex h-7 items-center justify-center gap-2.5 whitespace-nowrap rounded-lg px-4 py-1.5 text-center text-sm font-bold leading-[112.5%]',
            "font-['Noto_Sans_TC',sans-serif]",
            statusBadgeClasses(row.status_bucket),
          )}
        >
          {statusText(row.status_bucket)}
        </span>
      )
    case 'send_datetime':
      return <>{formatCellDateTime(row.send_datetime)}</>
    case 'shipment_method':
      return <>{shipmentLabel(row.shipment_method)}</>
    case 'pay_status':
      return <></>
    case 'customer_name':
      return <>{row.customer_name}</>
    case 'customer_phone':
      return <>{row.customer_phone}</>
    case 'item':
      return <>{row.item}</>
    case 'quantity':
      return <>{row.quantity}</>
    case 'note':
      return <>{row.note ?? ''}</>
    case 'total_amount':
      return <>{row.total_amount}</>
    case 'pay_way':
      return <>{row.pay_way ?? ''}</>
  }
}
