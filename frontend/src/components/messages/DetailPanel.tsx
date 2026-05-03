import { useCallback, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { createOrderFromDraft, sendOrderDraft, updateOrder } from '@/api/orders'
import type { OrderDraftPayload } from '@/types/models'
import { getErrorDetail } from '@/utils/errors'
import './DetailPanel.css'

const editableFields = [
  '客戶姓名',
  '客戶電話',
  '收件人姓名',
  '收件人電話',
  '總金額',
  '品項',
  '數量',
  '備註',
  '卡片訊息',
  '取貨方式',
  '送貨日期',
  '收件地址',
  '送貨地址',
  '付款方式',
] as const

const columns = [
  '客戶姓名',
  '客戶電話',
  '收件人姓名',
  '收件人電話',
  '總金額',
  '品項',
  '數量',
  '備註',
  '卡片訊息',
  '取貨方式',
  '送貨日期',
  '收件地址',
  '送貨地址',
  '訂單日期',
  '付款方式',
  '星期',
] as const

const EMPTY_DRAFT: Readonly<Record<string, unknown>> = {}

const fieldMissingMap: Record<string, string> = {
  數量: 'quantity',
  總金額: 'total_amount',
  品項: 'item',
  客戶姓名: 'customer_name',
  客戶電話: 'customer_phone',
  收件人姓名: 'receiver_name',
  收件人電話: 'receiver_phone',
  取貨方式: 'shipment_method',
  送貨日期: 'send_datetime',
  收件地址: 'receipt_address',
  送貨地址: 'delivery_address',
  付款方式: 'pay_way',
}

interface DetailPanelProps {
  orderData: Record<string, unknown> | null
  roomId: string | undefined
  onClose: () => void
  /** Parent should reload draft from API (parity with Vue `orderDraftUpdated`). */
  onOrderDraftUpdated: () => void
}

/** Display formatter for timestamps in read-only draft rows */
function formatDateTimeDisplay(raw: unknown): string {
  if (raw == null || raw === '') return ' '
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return ' '
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function str(raw: unknown): string {
  if (raw === null || raw === undefined) return ' '
  return String(raw)
}

export default function DetailPanel({
  orderData,
  roomId,
  onClose,
  onOrderDraftUpdated,
}: DetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  /** Local editor values keyed by column label (Vue parity). */
  const [edited, setEdited] = useState<Record<string, string>>({})
  const [missingBackendKeys, setMissingBackendKeys] = useState<string[]>([])
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({})

  const setRef = useCallback((col: string, el: HTMLInputElement | HTMLSelectElement | null) => {
    inputRefs.current[col] = el
  }, [])

  const dataRow = useMemo(() => orderData ?? EMPTY_DRAFT, [orderData])

  const dataList = useMemo(() => {
    const ship = dataRow.shipment_method === 'STORE_PICKUP' ? '店取' : '外送'
    return [
      str(dataRow.customer_name),
      str(dataRow.customer_phone),
      str(dataRow.receiver_name),
      str(dataRow.receiver_phone),
      dataRow.total_amount != null && dataRow.total_amount !== ''
        ? `NT ${String(dataRow.total_amount)}`
        : ' ',
      str(dataRow.item),
      dataRow.quantity != null && dataRow.quantity !== '' ? str(dataRow.quantity) : ' ',
      str(dataRow.note),
      str(dataRow.card_message),
      ship,
      formatDateTimeDisplay(dataRow.send_datetime),
      str(dataRow.receipt_address),
      str(dataRow.delivery_address),
      formatDateTimeDisplay(dataRow.order_date),
      str(dataRow.pay_way),
      str(dataRow.weekday),
    ]
  }, [dataRow])

  function patchEdited(key: string, value: string) {
    setEdited((prev) => ({ ...prev, [key]: value }))
  }

  function startEditing() {
    const next: Record<string, string> = {}
    columns.forEach((col, idx) => {
      if (!editableFields.includes(col as (typeof editableFields)[number])) return
      if (col === '送貨日期') {
        const cell = dataList[idx] ?? ' '
        const date = new Date(cell.trim())
        if (!Number.isNaN(date.getTime())) {
          next[`${col}_date`] = date.toISOString().split('T')[0]!
          next[`${col}_time`] = date.toTimeString().slice(0, 5)
        } else {
          const now = new Date()
          next[`${col}_date`] = now.toISOString().split('T')[0]!
          next[`${col}_time`] = now.toTimeString().slice(0, 5)
        }
      } else {
        next[col] = dataList[idx] ?? ' '
      }
    })
    setEdited(next)
    setIsEditing(true)
  }

  function isoWith331Suffix(d: Date) {
    return d.toISOString().replace(/\.\d{3}Z$/, '.331Z')
  }

  /** Payload built from edited form (parity with Vue `confirmEditing`). */
  function buildDraftFromEdited(): OrderDraftPayload {
    return {
      customer_name: edited['客戶姓名'] || '',
      customer_phone: edited['客戶電話'] || '',
      receiver_name: edited['收件人姓名'] || '',
      receiver_phone: edited['收件人電話'] || '',
      total_amount: parseFloat(String(edited['總金額'] ?? '').replace('NT ', '') || '0'),
      item: edited['品項'] || '',
      quantity: parseInt(String(edited['數量'] || '0'), 10),
      note: edited['備註'] || '',
      card_message: edited['卡片訊息'] || '',
      shipment_method: edited['取貨方式'] === '店取' ? 'STORE_PICKUP' : 'DELIVERY',
      send_datetime:
        edited['送貨日期_date'] && edited['送貨日期_time']
          ? isoWith331Suffix(
              new Date(`${edited['送貨日期_date']}T${edited['送貨日期_time']}`)
            )
          : isoWith331Suffix(new Date()),
      receipt_address: edited['收件地址'] || '',
      delivery_address: edited['送貨地址'] || '',
      pay_way: edited['付款方式'] || '',
      pay_way_id: 0,
    }
  }

  /**
   * Build PATCH body merging live editor overrides with the current draft snapshot.
   * Mirrors Vue behaviour: after `sendOrderDraft` clears `edited`, most fields resolve to props.
   */
  function buildDraftUpdatePayload(): OrderDraftPayload {
    const numAmt = (): number =>
      edited['總金額'] != null && edited['總金額'] !== ''
        ? parseFloat(String(edited['總金額']).replace('NT ', '') || '0')
        : parseFloat(String(dataRow.total_amount ?? '0') || '0')

    const qtyVal = (): number =>
      edited['數量'] != null && edited['數量'] !== ''
        ? parseInt(String(edited['數量']), 10)
        : parseInt(String(dataRow.quantity ?? '0'), 10)

    const ship =
      edited['取貨方式'] === '店取'
        ? 'STORE_PICKUP'
        : edited['取貨方式'] === '外送'
          ? 'DELIVERY'
          : dataRow.shipment_method === 'STORE_PICKUP'
            ? 'STORE_PICKUP'
            : 'DELIVERY'

    const sendDt =
      edited['送貨日期_date'] && edited['送貨日期_time']
        ? isoWith331Suffix(new Date(`${edited['送貨日期_date']}T${edited['送貨日期_time']}`))
        : dataRow.send_datetime
          ? isoWith331Suffix(new Date(String(dataRow.send_datetime)))
          : isoWith331Suffix(new Date())

    return {
      customer_name: edited['客戶姓名'] || str(dataRow.customer_name),
      customer_phone: edited['客戶電話'] || str(dataRow.customer_phone),
      receiver_name: edited['收件人姓名'] || str(dataRow.receiver_name),
      receiver_phone: edited['收件人電話'] || str(dataRow.receiver_phone),
      total_amount: numAmt(),
      item: edited['品項'] || str(dataRow.item),
      quantity: qtyVal(),
      note: edited['備註'] || str(dataRow.note),
      card_message: edited['卡片訊息'] || str(dataRow.card_message),
      shipment_method: ship,
      send_datetime: sendDt,
      receipt_address: edited['收件地址'] || str(dataRow.receipt_address),
      delivery_address: edited['送貨地址'] || str(dataRow.delivery_address),
      pay_way: edited['付款方式'] || str(dataRow.pay_way),
      pay_way_id: 0,
    }
  }

  function fixShipmentForSave(): void {
    if (edited['取貨方式'] === undefined) {
      patchEdited(
        '取貨方式',
        dataRow.shipment_method === 'STORE_PICKUP' ? '店取' : '外送'
      )
    }
  }

  async function confirmEditing() {
    if (!roomId) return
    fixShipmentForSave()
    const body = buildDraftFromEdited()
    await sendOrderDraft(roomId, body)
    setIsEditing(false)
    setEdited({})
    onOrderDraftUpdated()
  }

  async function handleCreateOrder() {
    if (!roomId) return
    try {
      if (isEditing) {
        fixShipmentForSave()
        const body = buildDraftFromEdited()
        await sendOrderDraft(roomId, body)
        setIsEditing(false)
        setEdited({})
      }

      const response = await createOrderFromDraft(roomId)

      // Vue relies on loose equality (`== ''`) meaning only an empty-string body is OK.
      if (response == '') {
        alert('工單建立成功！')
        setMissingBackendKeys([])
        onOrderDraftUpdated()
        return
      }

      alert('請填入缺少的資料')
      if (Array.isArray(response)) setMissingBackendKeys(response as string[])
    } catch (e: unknown) {
      console.error(e)
      if (axios.isAxiosError(e) && Array.isArray(e.response?.data)) {
        setMissingBackendKeys(e.response?.data as string[])
      } else {
        alert(`建立工單失敗: ${getErrorDetail(e)}`)
      }
    }
  }

  async function handleUpdateOrderClick() {
    if (!roomId) return
    try {
      if (isEditing) {
        fixShipmentForSave()
        await sendOrderDraft(roomId, buildDraftFromEdited())
        setIsEditing(false)
        setEdited({})
        // Give parent a beat to reconcile draft reads (matches Vue chaining).
        onOrderDraftUpdated()
      }

      const payload = buildDraftUpdatePayload()
      await updateOrder(roomId, payload)

      alert('工單更新成功！')
      onOrderDraftUpdated()
    } catch (e: unknown) {
      console.error(e)
      alert(`更新工單失敗: ${getErrorDetail(e)}`)
    }
  }

  /** Tab / Enter hops between editable widgets (parity with Vue). */
  function focusNextEditable(currentCol: string) {
    const idxList = editableFields.findIndex((c) => c === currentCol)
    if (idxList < 0 || idxList >= editableFields.length - 1) return
    const nextCol = editableFields[idxList + 1]!
    const el = inputRefs.current[nextCol]
    queueMicrotask(() => el?.focus())
  }

  function isMissingField(columnLabel: string) {
    const key = fieldMissingMap[columnLabel]
    if (!key) return false
    return missingBackendKeys.includes(key)
  }

  function toggleEdit() {
    if (isEditing) {
      void confirmEditing().catch((e: unknown) => {
        alert(`更新訂單失敗: ${getErrorDetail(e)}`)
      })
    } else {
      startEditing()
    }
  }

  const renderEditableControl = (
    col: (typeof columns)[number],
    displayIdx: number
  ) => {
    if (!(editableFields as readonly string[]).includes(col)) return null
    if (col === '取貨方式') {
      return (
        <select
          ref={(el) => setRef(col, el)}
          className={`edit-select${isMissingField(col) ? ' missing-field-input' : ''}`}
          value={edited[col] ?? String(dataList[displayIdx]).trim()}
          onChange={(e) => patchEdited(col, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              focusNextEditable(col)
            }
          }}
        >
          <option value="店取">店取</option>
          <option value="外送">外送</option>
        </select>
      )
    }
    return (
      <input
        ref={(el) => setRef(col, el)}
        className={`edit-input${isMissingField(col) ? ' missing-field-input' : ''}`}
        type="text"
        value={edited[col] ?? ''}
        onChange={(e) => patchEdited(col, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            focusNextEditable(col)
          }
        }}
      />
    )
  }

  const rowsRendered = columns.map((col, idx) => {
    const editable = editableFields.includes(col as (typeof editableFields)[number])
    if (col === '送貨日期') {
      return (
        <div key={col}>
          <div className="dp-row">
            <div className={`dp-col-label${isMissingField(col) ? ' missing-field' : ''}`}>
              {col}
            </div>
            <div className="dp-value">
              {isEditing ? (
                <input
                  type="date"
                  className={`edit-input${isMissingField(col) ? ' missing-field-input' : ''}`}
                  value={edited[`${col}_date`] ?? ''}
                  onChange={(e) => patchEdited(`${col}_date`, e.target.value)}
                />
              ) : (
                <span className={`data${isMissingField(col) ? ' missing-field' : ''}`}>
                  {dataList[idx]}
                </span>
              )}
            </div>
          </div>
          <div className="dp-row">
            <div className="dp-col-label" />
            <div className="dp-value">
              {isEditing ? (
                <input
                  type="time"
                  step={300}
                  className={`edit-input${isMissingField(col) ? ' missing-field-input' : ''}`}
                  value={edited[`${col}_time`] ?? ''}
                  onChange={(e) => patchEdited(`${col}_time`, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      focusNextEditable(col)
                    }
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="dp-row" key={col}>
        <div className={`dp-col-label${isMissingField(col) ? ' missing-field' : ''}`}>{col}</div>
        <div className="dp-value">
          {isEditing && editable ? (
            renderEditableControl(col, idx)
          ) : (
            <span className={`data${isMissingField(col) ? ' missing-field' : ''}`}>
              {dataList[idx]}
            </span>
          )}
        </div>
      </div>
    )
  })

  return (
    <div className="order-detail-panel">
      <div className="dp-section-head">
        <div className="dp-head-inner">
          <div className="dp-title-group">
            <span className="dp-section-title">訂單草稿</span>
            <button type="button" className="edit-btn" onClick={toggleEdit}>
              <div className="press-inner">
                {isEditing ? (
                  <i className="fas fa-check icon" />
                ) : (
                  <i className="fas fa-pen icon" />
                )}
              </div>
            </button>
          </div>
          <button type="button" className="close-panel-btn" aria-label="Close" onClick={onClose}>
            <span className="ellipse-bg" />
            <i className="fas fa-angle-double-left chevrons-left" />
          </button>
        </div>
      </div>
      <div className="order-detail-scroll">{rowsRendered}</div>
      <div className="frame-actions">
        <button
          type="button"
          className={`order-act-btn update${isEditing ? ' editing' : ''}`}
          onClick={handleUpdateOrderClick}
        >
          <i className="fas fa-upload btn-icon" />
          <span className="btn-text">更新工單</span>
        </button>
        <button
          type="button"
          className={`order-act-btn create${isEditing ? ' editing' : ''}`}
          onClick={handleCreateOrder}
        >
          <i className="fas fa-plus btn-icon" />
          <span className="btn-text">建立新工單</span>
        </button>
      </div>
    </div>
  )
}
