import { useMemo, useState } from 'react'
import type { ChatRoomUi } from '@/types/models'
import { getStatusClass, getStatusDisplay } from '@/utils/statusMapping'
import './ChatListWrapper.css'

const tabs = [
  { key: 'ALL', label: '所有訂單' },
  { key: 'WELCOME', label: '歡迎' },
  { key: 'ORDER_CONFIRM', label: '等待備貨' },
  { key: 'WAITING_OWNER', label: '人工溝通' },
  { key: 'BOT_ACTIVE', label: '自動回覆' },
] as const

type TabKey = (typeof tabs)[number]['key']

interface ChatListWrapperProps {
  chatRooms: ChatRoomUi[]
  selectedRoomId: string | undefined
  onSelectRoom: (room: ChatRoomUi) => void
}

export default function ChatListWrapper({
  chatRooms,
  selectedRoomId,
  onSelectRoom,
}: ChatListWrapperProps) {
  const [currentTab, setCurrentTab] = useState<TabKey>('ALL')

  const filteredRooms = useMemo(() => {
    if (currentTab === 'ALL') return chatRooms
    return chatRooms.filter((r) => r.status === currentTab)
  }, [chatRooms, currentTab])

  const unreadBadge = useMemo(
    () =>
      chatRooms.reduce(
        (sum, room) =>
          sum +
          (String(selectedRoomId) !== String(room.id) ? room.unreadCount || 0 : 0),
        0
      ),
    [chatRooms, selectedRoomId]
  )

  function formatTime(timestamp: Date | null) {
    if (!timestamp) return ''
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  function statusBadgeClass(status: string) {
    return getStatusClass(status)
  }

  return (
    <div className="chat-list-shell">
      <div className="chat-list-heading">
        <div className="chat-list-head-inner">
          <div className="message-circle">
            <i className="far fa-comment" style={{ color: '#6168FC' }} />
          </div>
          <span className="message-title-strong">Message</span>
          <div className="number-wrapper">
            <div className="number-circle" />
            <span className="number-value">{unreadBadge}</span>
          </div>
        </div>
      </div>
      <div className="chat-list-scroll">
        <div className="filter-bar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`filter-btn${currentTab === tab.key ? ' active' : ''}`}
              onClick={() => setCurrentTab(tab.key)}
            >
              <span className="filter-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className={`customer-card-wrapper${String(selectedRoomId) === String(room.id) ? ' active' : ''}`}
            role="presentation"
            onClick={() => onSelectRoom(room)}
          >
            <div className="frame6">
              <img className="pic" src={room.avatar || ''} alt="" />
              <div className="frame5">
                <div className="frame4">
                  <div className="frame3">
                    <span className="name">{room.name}</span>
                    <span className="time">{formatTime(room.lastMessageTime)}</span>
                  </div>
                  <div className="frame7">
                    <span className="unread_text">{room.lastMessage}</span>
                    {room.unreadCount > 0 && String(selectedRoomId) !== String(room.id) ? (
                      <span className="unread_point" />
                    ) : null}
                  </div>
                </div>
                <div className={`frame2 ${statusBadgeClass(room.status)}`}>
                  <span className={`status-label ${statusBadgeClass(room.status)}`}>
                    {getStatusDisplay(room.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
