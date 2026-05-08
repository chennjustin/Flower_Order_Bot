import { useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { ChatRoom } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'
import {
  getStatusBadgeClasses,
  getStatusDisplay,
} from '@/utils/statusMapping'
import { cn } from '@/lib/utils'

const FILTER_TABS: ReadonlyArray<{ key: 'ALL' | ChatRoomStage; label: string }> = [
  { key: 'ALL', label: '所有訂單' },
  { key: 'WELCOME', label: '歡迎' },
  { key: 'ORDER_CONFIRM', label: '等待備貨' },
  { key: 'WAITING_OWNER', label: '人工溝通' },
  { key: 'BOT_ACTIVE', label: '自動回覆' },
]

interface ChatListProps {
  rooms: ChatRoom[]
  selectedRoomId: number | null
  onSelect: (room: ChatRoom) => void
  isLoading?: boolean
}

export default function ChatList({
  rooms,
  selectedRoomId,
  onSelect,
  isLoading,
}: ChatListProps) {
  const [currentTab, setCurrentTab] = useState<(typeof FILTER_TABS)[number]['key']>('ALL')

  const filteredRooms = useMemo(() => {
    if (currentTab === 'ALL') return rooms
    return rooms.filter(r => r.status === currentTab)
  }, [rooms, currentTab])

  const totalUnread = useMemo(
    () =>
      rooms.reduce(
        (sum, room) =>
          sum + (selectedRoomId !== room.room_id ? room.unread_count : 0),
        0,
      ),
    [rooms, selectedRoomId],
  )

  return (
    <div className="flex h-full w-[360px] flex-col border-r border-[#B3B3B3] bg-white">
      <div className="flex h-20 items-center border-b-[1.5px] border-[#e9e9e9]">
        <div className="ml-6 flex h-9 items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center text-[#6168FC]">
            <MessageSquare className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-2xl font-bold tracking-[0.1em] text-[#6168FC] font-['Noto_Sans_TC',sans-serif]">
            Message
          </span>
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#D8EAFF] text-sm font-bold text-[#528DD2] font-['Noto_Sans_TC',sans-serif]">
            {totalUnread}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex h-10 items-center gap-1 overflow-x-auto bg-[#F7F7F7] px-3 py-1.5 whitespace-nowrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCurrentTab(tab.key)}
              className={cn(
                'inline-flex h-7 w-[72px] flex-shrink-0 items-center justify-center rounded-[36px] px-2 text-sm font-bold whitespace-nowrap transition-colors',
                "font-['Noto_Sans_TC',sans-serif] text-black/60",
                currentTab === tab.key ? 'bg-[#C5C7FF]' : 'bg-[#F7F7F7] hover:bg-[#C5C7FF]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading && rooms.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-black/40">載入中...</div>
        ) : filteredRooms.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-black/40">
            目前沒有聊天室
          </div>
        ) : (
          <ul>
            {filteredRooms.map(room => (
              <li key={room.room_id}>
                <ChatRoomCard
                  room={room}
                  active={selectedRoomId === room.room_id}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface ChatRoomCardProps {
  room: ChatRoom
  active: boolean
  onSelect: (room: ChatRoom) => void
}

function ChatRoomCard({ room, active, onSelect }: ChatRoomCardProps) {
  const lastMessageTime = room.last_message?.timestamp
    ? formatRoomTime(room.last_message.timestamp)
    : ''
  const showUnreadDot = !active && room.unread_count > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      className={cn(
        'flex h-[100px] w-full items-center px-[17px] text-left transition-colors',
        active ? 'bg-[#D8EAFF]' : 'bg-transparent hover:bg-black/[0.03]',
      )}
    >
      <div className="flex w-full items-center gap-4">
        <Avatar src={room.user_avatar_url} alt={room.user_name} size={56} />
        <div className="flex h-[74px] flex-1 flex-col justify-between gap-2 overflow-hidden">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-base font-bold text-black font-['Noto_Sans_TC',sans-serif]">
                {room.user_name}
              </span>
              <span className="ml-2 flex-shrink-0 text-base font-bold text-black/[0.38] font-['Noto_Sans_TC',sans-serif]">
                {lastMessageTime}
              </span>
            </div>
            <div className="flex items-center justify-between pr-2">
              <span className="truncate text-sm text-black/60 font-['Noto_Sans_TC',sans-serif]">
                {room.last_message?.text ?? ''}
              </span>
              {showUnreadDot && (
                <span className="ml-2 h-3 w-3 flex-shrink-0 rounded-full bg-[#77B5FF]" />
              )}
            </div>
          </div>
          <div className="flex">
            <span
              className={cn(
                'flex h-5 max-w-[92px] items-center justify-center rounded-xl px-3 text-xs font-bold whitespace-nowrap',
                "font-['Noto_Sans_TC',sans-serif]",
                getStatusBadgeClasses(room.status),
              )}
            >
              {getStatusDisplay(room.status)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

interface AvatarProps {
  src?: string | null
  alt: string
  size: number
}

function Avatar({ src, alt, size }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="flex-shrink-0 rounded-full bg-[#D9D9D9] object-cover"
        onError={e => {
          ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
        }}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex-shrink-0 rounded-full bg-[#D9D9D9]"
    />
  )
}

function formatRoomTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
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
