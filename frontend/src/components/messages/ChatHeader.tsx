import { useState } from 'react'
import { getStatusClass, getStatusDisplay } from '@/utils/statusMapping'
import { fetchOrderDraft, readOrderDraft } from '@/api/orders'
import './ChatHeader.css'

interface ChatHeaderProps {
  roomName: string
  avatar: string
  status: string
  roomId: string | undefined
  /** Always opens the draft panel (back chevron parity with Vue). */
  openDetailPanel: () => void
  /** Applies latest draft payload onto parent state before opening sheet. */
  onDraftLoaded: (data: Record<string, unknown>) => void
}

export default function ChatHeader({
  roomName,
  avatar,
  status,
  roomId,
  openDetailPanel,
  onDraftLoaded,
}: ChatHeaderProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const statusClass = getStatusClass(status)

  async function handleBackClick() {
    if (!roomId) {
      openDetailPanel()
      return
    }
    try {
      const data = await readOrderDraft(roomId)
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        onDraftLoaded(data)
      }
      openDetailPanel()
    } catch {
      openDetailPanel()
    }
  }

  async function handleOrderClick() {
    if (!roomId) return
    setIsProcessing(true)
    try {
      const data = await fetchOrderDraft(roomId)
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        onDraftLoaded(data)
        openDetailPanel()
      } else {
        alert('此聊天室尚未有訂單資料，請先建立訂單')
      }
    } catch (e: unknown) {
      alert(`Error fetching order draft: ${String((e as Error).message ?? e)}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="chat-header">
      <img className="chat-avatar" src={avatar} alt="avatar" />
      <div className="header-title-row">
        <span className="room-name">{roomName}</span>
        <span className={`chat-status-badge status-${statusClass}`}>
          {getStatusDisplay(status)}
        </span>
        <button type="button" className="back-btn" onClick={handleBackClick}>
          <i className="fas fa-angle-double-left" />
        </button>
      </div>
      <button
        type="button"
        className="organize-order-btn"
        onClick={handleOrderClick}
      >
        {isProcessing ? <div className="loading-spinner" /> : null}
        {!isProcessing ? (
          <>
            <i className="fas fa-archive" />
            <span className="btn-text">整理資料</span>
          </>
        ) : null}
      </button>
    </div>
  )
}
