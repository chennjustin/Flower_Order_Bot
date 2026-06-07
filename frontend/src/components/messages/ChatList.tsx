import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Search, X } from 'lucide-react'
import { prefetchRoomMessages } from '@/hooks/useRoomMessages'
import type { ChatRoom } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'
import {
  getStatusBadgeClasses,
  getStatusDisplay,
} from '@/utils/statusMapping'
import { cn } from '@/lib/utils'

const FILTER_TABS: ReadonlyArray<{ key: 'ALL' | ChatRoomStage; label: string }> = [
  { key: 'ALL', label: '所有對話' },
  { key: 'WELCOME', label: '歡迎' },
  { key: 'ORDER_CONFIRM', label: '討論完成' },
  { key: 'WAITING_OWNER', label: '人工溝通' },
  { key: 'BOT_ACTIVE', label: '自動回覆' },
]

interface ChatListProps {
  rooms: ChatRoom[]
  selectedRoomId: number | null
  onSelect: (room: ChatRoom) => void
  isLoading?: boolean
  isFetchingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  totalUnread?: number
  currentStage: ChatRoomStage | 'ALL'
  onStageChange: (stage: ChatRoomStage | 'ALL') => void
  searchQuery: string
  onSearchChange: (q: string) => void
  storeId: number | null
}

export default function ChatList({
  rooms,
  selectedRoomId,
  onSelect,
  isLoading,
  isFetchingMore,
  hasMore,
  onLoadMore,
  totalUnread = 0,
  currentStage,
  onStageChange,
  searchQuery,
  onSearchChange,
  storeId,
}: ChatListProps) {
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState(searchQuery)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput.trim() !== searchQuery.trim()) {
        onSearchChange(searchInput.trim())
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput, onSearchChange, searchQuery])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasMore || !onLoadMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isFetchingMore) {
          onLoadMore()
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isFetchingMore, onLoadMore, rooms.length])

  function commitSearch() {
    onSearchChange(searchInput.trim())
  }

  function clearSearch() {
    setSearchInput('')
    onSearchChange('')
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-[#B3B3B3] bg-white md:w-[360px]">
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
        <div className="flex h-12 flex-shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden bg-[#F7F7F7] px-3 whitespace-nowrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStageChange(tab.key)}
              className={cn(
                'inline-flex h-7 w-[72px] flex-shrink-0 items-center justify-center rounded-[36px] px-2 text-sm font-bold whitespace-nowrap transition-colors',
                "font-['Noto_Sans_TC',sans-serif] text-black/60",
                currentStage === tab.key ? 'bg-[#C5C7FF]' : 'bg-[#F7F7F7] hover:bg-[#C5C7FF]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-shrink-0 px-3 py-2">
          <div className="relative flex h-9 w-full items-center rounded-[36px] border border-[#E0E0E0] bg-white px-4 transition focus-within:border-[#77B5FF] focus-within:shadow-[0_0_0_3px_rgba(119,181,255,0.2)]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitSearch()
                }
              }}
              placeholder="搜尋顧客姓名"
              className="w-full border-0 bg-transparent p-0 pr-6 text-sm leading-[140%] text-black/60 outline-none placeholder:text-black/[0.38] font-['Noto_Sans_TC',sans-serif]"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="清除搜尋"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/[0.38] transition-colors hover:text-black/60"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={commitSearch}
                aria-label="搜尋"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/[0.38] transition-colors hover:text-black/60"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {isLoading && rooms.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-black/40">載入中...</div>
        ) : rooms.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-black/40">
            目前沒有聊天室
          </div>
        ) : (
          <ul>
            {rooms.map(room => (
              <li key={room.room_id}>
                <ChatRoomCard
                  room={room}
                  active={selectedRoomId === room.room_id}
                  onSelect={onSelect}
                  onPrefetch={() => {
                    if (storeId != null) prefetchRoomMessages(qc, storeId, room.room_id)
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div
            ref={loadMoreRef}
            className="px-6 py-4 text-center text-sm text-black/40"
          >
            {isFetchingMore ? '載入更多...' : '往下捲動載入更多'}
          </div>
        )}
      </div>
    </div>
  )
}

interface ChatRoomCardProps {
  room: ChatRoom
  active: boolean
  onSelect: (room: ChatRoom) => void
  onPrefetch: () => void
}

function ChatRoomCard({ room, active, onSelect, onPrefetch }: ChatRoomCardProps) {
  const lastMessageTime = room.last_message?.timestamp
    ? formatRoomTime(room.last_message.timestamp)
    : ''
  const showUnreadDot = !active && room.unread_count > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        'flex h-[100px] w-full items-center px-[17px] text-left transition-colors',
        active ? 'md:bg-[#D8EAFF]' : 'bg-transparent hover:bg-black/[0.03]',
      )}
    >
      <div className="flex w-full items-center gap-4">
        <Avatar src={room.user_avatar_url} alt={room.user_name} size={56} />
        <div className="flex flex-1 flex-col justify-between gap-2 overflow-hidden">
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
