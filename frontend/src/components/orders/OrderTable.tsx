import { useMemo, useState, type ReactNode } from 'react'
import axios from 'axios'
import { exportDocx, deleteOrder } from '@/api/orders'
import type { OrderRecord } from '@/types/models'
import { getStatusDisplay, normalizeOrderStatus, orderStatusBadgeClass } from '@/utils/statusMapping'
import './OrderTable.css'

const columnMapping: Record<string, keyof OrderRecord> = {
  匯出工單: 'order_status',
  訂單編號: 'id',
  狀態: 'order_status',
  取貨時間: 'send_datetime',
  姓名: 'customer_name',
  電話: 'customer_phone',
  商品: 'item',
  數量: 'quantity',
  備註: 'note',
  取貨方式: 'shipment_method',
  金額: 'total_amount',
  付款方式: 'pay_way',
  付款狀態: 'pay_status',
  取消訂單: 'id',
}

const columnWidths: Record<string, string> = {
  訂單編號: '136px',
  狀態: '120px',
  取貨時間: '200px',
  姓名: '96px',
  電話: '112px',
  商品: '96px',
  數量: '96px',
  備註: '128px',
  取貨方式: '128px',
  金額: '96px',
  付款方式: '128px',
  付款狀態: '112px',
  取消訂單: '96px',
}

type StatusTab = 'WELCOME' | 'ORDER_CONFIRM' | 'WAITING_OWNER' | 'BOT_ACTIVE' | ''

function getErrorDetail(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const raw = err.response?.data as { detail?: unknown } | undefined
    if (raw && raw.detail !== undefined) return String(raw.detail)
    return err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}

interface OrderTableProps {
  /** Raw rows exactly as returned by /orders */
  data: OrderRecord[]
  columnName: string[]
  /** Called after a successful DELETE so parent can invalidate queries or refetch */
  onOrderDeleted?: () => void | Promise<void>
}

export default function OrderTable({ data, columnName, onOrderDeleted }: OrderTableProps) {
  const [searchText, setSearchText] = useState('')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [activeTab, setActiveTab] = useState<StatusTab>('')
  const [dateFilterActive, setDateFilterActive] = useState(false)

  const normalizedRows = useMemo(() => {
    return (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      order_status: normalizeOrderStatus(String(row.order_status ?? '')),
    }))
  }, [data])

  const filteredData = useMemo(() => {
    let result = [...normalizedRows]
    const canonical: StatusTab[] = ['WELCOME', 'ORDER_CONFIRM', 'WAITING_OWNER', 'BOT_ACTIVE']
    if (canonical.includes(activeTab as StatusTab)) {
      result = result.filter((row) => row.order_status === activeTab)
    }
    if (dateFilterActive) {
      const filterStr = currentDate.toISOString().slice(0, 10)
      result = result.filter((row) => {
        if (!row.send_datetime) return false
        const rowDate = new Date(row.send_datetime as string).toISOString().slice(0, 10)
        return rowDate === filterStr
      })
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter((row) =>
        Object.values(row ?? {}).some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(q)
        )
      )
    }
    return result
  }, [normalizedRows, activeTab, dateFilterActive, currentDate, searchText])

  function formatDate(date: Date) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日 (${weekdays[date.getDay()]})`
  }

  function formatDateTime(datetime: string | null | undefined) {
    if (!datetime) return ''
    const date = new Date(datetime)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear().toString().slice(-2)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${year}/${month}/${day}（${weekdays[date.getDay()]}）${hours}:${minutes}`
  }

  function goToPreviousDay() {
    const nd = new Date(currentDate)
    nd.setDate(nd.getDate() - 1)
    setCurrentDate(nd)
    setDateFilterActive(true)
    setActiveTab('')
  }

  function goToNextDay() {
    const nd = new Date(currentDate)
    nd.setDate(nd.getDate() + 1)
    setCurrentDate(nd)
    setDateFilterActive(true)
    setActiveTab('')
  }

  function downloadCSV() {
    const rows = data.map((row) => [
      row.order_status,
      row.id,
      row.order_status,
      row.send_datetime,
      row.customer_name,
      row.customer_phone,
      row.item,
      row.quantity,
      row.note,
      row.shipment_method === 'store_pickup' ? '店取' : '外送',
      row.total_amount,
      row.pay_way,
      row.pay_status,
      row.id,
    ])

    const csvContent = [columnName, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', '訂單資料.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  async function handleExportDocx(orderId: number | string) {
    try {
      const blob = await exportDocx(orderId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `order_${orderId}.docx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error: unknown) {
      console.error('Error exporting docx:', error)
      alert(`匯出工單失敗: ${getErrorDetail(error)}`)
    }
  }

  async function handleCancelOrder(orderId: number | string) {
    if (!window.confirm('確定要刪除此訂單嗎？此操作無法復原。')) return
    try {
      await deleteOrder(orderId)
      alert('訂單已成功取消')
      await onOrderDeleted?.()
    } catch (error: unknown) {
      console.error('Error canceling order:', error)
      alert(`取消訂單時發生錯誤：${getErrorDetail(error)}`)
    }
  }

  function setTab(tab: StatusTab) {
    setActiveTab(tab)
    setDateFilterActive(false)
  }

  function onDateFilterClick() {
    setDateFilterActive(true)
    setActiveTab('')
  }

  function cellValue(column: string, row: OrderRecord): ReactNode {
    const key = columnMapping[column]
    if (column === '匯出工單') {
      return (
        <button
          type="button"
          className="work-order-btn"
          onClick={() => handleExportDocx(row.id)}
        >
          工單
        </button>
      )
    }
    if (column === '取消訂單') {
      return (
        <button type="button" className="cancel-order-btn" onClick={() => handleCancelOrder(row.id)}>
          刪除
        </button>
      )
    }
    const rawKey = key as keyof OrderRecord
    const value = row[rawKey]
    if (column === '取貨時間') {
      return formatDateTime(value as string)
    }
    if (column === '取貨方式') {
      return value === 'store_pickup' ? '店取' : '外送'
    }
    if (column === '狀態') {
      const st = String(value ?? '')
      return (
        <span className={`status-badge ${orderStatusBadgeClass(st)}`}>
          {getStatusDisplay(normalizeOrderStatus(st))}
        </span>
      )
    }
    return String(value ?? '')
  }

  return (
    <div className="order-section">
      <div className="order-title-row">
        <span className="order-table-title">訂單總覽</span>
      </div>
      <div className="order-filter-row">
        <div className="order-tabs">
          <button
            type="button"
            className={`tab${activeTab === 'WELCOME' ? ' active' : ''}`}
            onClick={() => setTab('WELCOME')}
          >
            歡迎
          </button>
          <button
            type="button"
            className={`tab${activeTab === 'ORDER_CONFIRM' ? ' active' : ''}`}
            onClick={() => setTab('ORDER_CONFIRM')}
          >
            等待備貨
          </button>
          <button
            type="button"
            className={`tab${activeTab === 'WAITING_OWNER' ? ' active' : ''}`}
            onClick={() => setTab('WAITING_OWNER')}
          >
            人工溝通
          </button>
          <button
            type="button"
            className={`tab${activeTab === 'BOT_ACTIVE' ? ' active' : ''}`}
            onClick={() => setTab('BOT_ACTIVE')}
          >
            自動回覆
          </button>
        </div>
        <div className="date-filter compact">
          <button type="button" className="date-nav-btn" onClick={goToPreviousDay}>
            <span className="arrow">&#60;</span>
          </button>
          <button
            type="button"
            className="current-date"
            onClick={onDateFilterClick}
            style={{
              cursor: 'pointer',
              fontWeight: dateFilterActive ? 'bold' : 'normal',
              color: dateFilterActive ? '#6168FC' : undefined,
              border: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
            }}
          >
            {formatDate(currentDate)}
          </button>
          <button type="button" className="date-nav-btn" onClick={goToNextDay}>
            <span className="arrow">&#62;</span>
          </button>
        </div>
        <div className="search-group">
          <input
            type="text"
            className="search-input"
            placeholder="搜尋訂單（姓名、編號等）"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <span className="search-icon">
            <i className="fas fa-search" />
          </span>
        </div>
        <button type="button" className="download-btn" onClick={downloadCSV}>
          <i className="fas fa-download" />
          <span>下載 CSV</span>
        </button>
      </div>
      <div className="table-container">
        <div className="table-wrapper-inner">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                {columnName.map((column) => (
                  <th key={column} style={{ width: columnWidths[column] }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={String(row.id)}>
                  {columnName.map((column) => (
                    <td key={column} style={{ width: columnWidths[column] }}>
                      {cellValue(column, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 ? (
          <div className="no-results">
            <i className="fas fa-search fa-2x mb-3" />
            <p>找不到符合條件的訂單</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
