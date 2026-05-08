import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
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
  CHAT_STATUS_TABS,
  type ChatStatus,
  normalizeStatus,
  shipmentLabel,
  statusBadgeClasses,
  statusText,
} from '@/utils/orderStatus'
import { formatCellDateTime, formatHeaderDate, toLocalDateKey } from '@/utils/datetime'
import { rowsToCsvBlob } from '@/utils/csv'
import { downloadBlob } from '@/utils/download'
import type { Order } from '@/types/domain'
import { cn } from '@/lib/utils'

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
  { key: 'export', label: '匯出工單' },
  { key: 'id', label: '訂單編號', width: '136px' },
  { key: 'status', label: '狀態', width: '120px' },
  { key: 'send_datetime', label: '取貨時間', width: '200px' },
  { key: 'customer_name', label: '姓名', width: '96px' },
  { key: 'customer_phone', label: '電話', width: '112px' },
  { key: 'item', label: '商品', width: '96px' },
  { key: 'quantity', label: '數量', width: '96px' },
  { key: 'note', label: '備註', width: '128px' },
  { key: 'shipment_method', label: '取貨方式', width: '128px' },
  { key: 'total_amount', label: '金額', width: '96px' },
  { key: 'pay_way', label: '付款方式', width: '128px' },
  { key: 'pay_status', label: '付款狀態', width: '112px' },
  { key: 'cancel', label: '取消訂單', width: '96px' },
]

interface NormalizedOrder extends Order {
  status_bucket: ChatStatus
}

export default function OrderTable() {
  const ordersQuery = useOrders()
  const deleteMutation = useDeleteOrder()

  const [activeTab, setActiveTab] = useState<ChatStatus | ''>('WELCOME')
  const [dateFilterActive, setDateFilterActive] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [searchText, setSearchText] = useState('')
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])

  const filtered = useMemo<NormalizedOrder[]>(() => {
    let rows: NormalizedOrder[] = orders.map(o => ({
      ...o,
      status_bucket: normalizeStatus(o.order_status as unknown as string),
    }))

    if (activeTab) {
      rows = rows.filter(r => r.status_bucket === activeTab)
    }

    if (dateFilterActive) {
      const key = toLocalDateKey(currentDate)
      rows = rows.filter(r => {
        if (!r.send_datetime) return false
        const d = new Date(r.send_datetime)
        if (Number.isNaN(d.getTime())) return false
        return toLocalDateKey(d) === key
      })
    }

    const q = searchText.trim().toLowerCase()
    if (q) {
      rows = rows.filter(r =>
        Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)),
      )
    }

    return rows
  }, [orders, activeTab, dateFilterActive, currentDate, searchText])

  function selectTab(value: ChatStatus) {
    setActiveTab(value)
    setDateFilterActive(false)
  }

  function shiftDate(days: number) {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + days)
    setCurrentDate(next)
    setDateFilterActive(true)
    setActiveTab('')
  }

  function toggleDateFilter() {
    setDateFilterActive(true)
    setActiveTab('')
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
      alert(`匯出工單失敗：${message}`)
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

  return (
    <section className="rounded-lg bg-white px-8 py-6 mt-6 mb-8 border-b-[1.5px] border-[#e9e9e9]">
      <div className="mb-2">
        <span className="text-[22px] font-bold tracking-wider whitespace-nowrap text-[#4F51FF]">
          訂單總覽
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="inline-flex h-10 items-center gap-1 rounded-[36px] bg-[#F7F7F7] px-3 py-1.5 overflow-x-auto shrink-0">
          {CHAT_STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => selectTab(tab.value)}
              className={cn(
                'flex h-7 items-center whitespace-nowrap rounded-[36px] px-6 py-[11px] text-sm font-bold leading-[112.5%] text-black/60 transition',
                "font-['Noto_Sans_TC',sans-serif]",
                activeTab === tab.value && 'bg-[#C5C7FF]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex h-10 items-center gap-3 rounded-[36px] bg-[#F7F7F7] px-4">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
            aria-label="前一天"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={toggleDateFilter}
            className={cn(
              'min-w-[80px] cursor-pointer text-center text-sm leading-[112.5%] whitespace-nowrap',
              "font-['Noto_Sans_TC',sans-serif] font-bold",
              dateFilterActive ? 'text-[#6168FC]' : 'text-black/40',
            )}
          >
            {formatHeaderDate(currentDate)}
          </button>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D9D9D9] text-white transition hover:bg-[#C5C7FF]"
            aria-label="後一天"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>

        <div className="relative flex h-[46px] w-[360px] min-w-[360px] items-center rounded-[36px] bg-[#D8EAFF] px-6 py-[11px]">
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
          className="flex h-[46px] w-[113px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-[#77B5FF] p-3 text-white shadow-[2px_2px_2px_rgba(0,0,0,0.25)] transition hover:opacity-90"
        >
          <Download className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-base font-bold leading-[112.5%] font-['Noto_Sans_TC',sans-serif]">
            下載 CSV
          </span>
        </button>
      </div>

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
                    <tr key={row.id} className="group bg-white">
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
          onClick={() => onExport(row.id)}
          className="flex h-7 w-[60px] max-w-[92px] items-center justify-center rounded-lg border-0 bg-[#77B5FF] px-4 py-1.5 text-sm font-bold text-white transition hover:opacity-80 font-['Noto_Sans_TC',sans-serif]"
        >
          工單
        </button>
      )
    case 'cancel':
      return (
        <button
          type="button"
          onClick={() => onDelete(row.id)}
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
