import { Archive, ChevronDown, ChevronLeft, ClipboardList, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useSwitchChatRoomMode, type ChatRoomsFilter } from '@/hooks/useChatRooms'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  getStatusBadgeClasses,
  getStatusDisplay,
  MANUAL_CHAT_STAGES,
} from '@/utils/statusMapping'
import type { ChatRoomStage } from '@/types/enums'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  roomId: number
  roomName: string
  avatar?: string | null
  status?: string | null
  detailPanelOpen?: boolean
  onBack?: () => void
  onOpenDetail: () => void
  onOrganizeOrder: () => void
  isOrganizing?: boolean
  showOrganizeButton?: boolean
  roomFilters: ChatRoomsFilter
}

export default function ChatHeader({
  roomId,
  roomName,
  avatar,
  status,
  detailPanelOpen,
  onBack,
  onOpenDetail,
  onOrganizeOrder,
  isOrganizing,
  showOrganizeButton = true,
  roomFilters,
}: ChatHeaderProps) {
  const switchMode = useSwitchChatRoomMode(roomId, roomFilters)
  const [stageMenuOpen, setStageMenuOpen] = useState(false)
  const currentStage = (status ?? 'IDLE') as ChatRoomStage
  const isSwitching = switchMode.isPending

  async function handleStageChange(next: ChatRoomStage) {
    if (next === currentStage || isSwitching) return
    try {
      await switchMode.mutateAsync(next)
      setStageMenuOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`切換聊天室狀態失敗：${message}`)
    }
  }

  const statusButton = status ? (
    <Popover open={stageMenuOpen} onOpenChange={setStageMenuOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isSwitching}
          aria-label="切換聊天室狀態"
          className={cn(
            'flex h-5 flex-shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold whitespace-nowrap transition',
            "font-['Noto_Sans_TC',sans-serif]",
            'disabled:cursor-wait disabled:opacity-70',
            getStatusBadgeClasses(currentStage),
          )}
        >
          {getStatusDisplay(currentStage)}
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-2">
        <ul className="flex flex-col gap-1">
          {MANUAL_CHAT_STAGES.map(stage => (
            <li key={stage}>
              <button
                type="button"
                disabled={isSwitching}
                onClick={() => handleStageChange(stage)}
                className={cn(
                  'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold transition',
                  "font-['Noto_Sans_TC',sans-serif]",
                  stage === currentStage
                    ? getStatusBadgeClasses(stage)
                    : 'text-black/70 hover:bg-black/[0.04]',
                )}
              >
                {getStatusDisplay(stage)}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  ) : null

  return (
    <header
      data-chat-header
      className="relative z-20 flex h-20 items-center gap-3 border-b-[1.5px] border-[#e9e9e9] bg-white px-4 md:px-6"
    >
      {/* Back button — mobile only */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="返回聊天列表"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#F5F6FF] hover:text-[#6168FC] md:hidden"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}

      {/* Avatar — desktop only */}
      {avatar ? (
        <img
          src={avatar}
          alt={roomName}
          className="hidden h-14 w-14 flex-shrink-0 rounded-full bg-[#e9e9e9] object-cover md:block"
          onError={e => { ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      ) : (
        <div className="hidden h-14 w-14 flex-shrink-0 rounded-full bg-[#e9e9e9] md:block" />
      )}

      {/* Name + status: stacked on mobile, inline on desktop */}
      <div className="flex min-w-0 flex-shrink flex-col justify-center gap-0.5 md:flex-row md:items-center md:gap-3">
        <span className="truncate text-[1.05rem] font-bold leading-tight text-[#6168FC] md:text-[1.15rem] md:whitespace-nowrap font-['Noto_Sans_TC',sans-serif]">
          {roomName}
        </span>
        {statusButton}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
        {!detailPanelOpen && (
          <button
            type="button"
            onClick={onOpenDetail}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-xl border border-[#C5C7FF] bg-white px-2.5 text-sm font-bold text-[#6168FC] transition md:h-10 md:gap-2 md:px-3',
              "font-['Noto_Sans_TC',sans-serif]",
              'hover:bg-[#F5F6FF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.12)] active:scale-95',
            )}
            aria-label="開啟訂單詳情"
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            <span>訂單</span>
          </button>
        )}
        {showOrganizeButton && (
          <button
            type="button"
            onClick={onOrganizeOrder}
            disabled={isOrganizing}
            className="flex h-9 items-center justify-center gap-2 rounded-xl bg-[#C5C7FF] px-2.5 text-sm font-bold text-white transition hover:bg-[#A8ACFF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)] active:scale-95 disabled:opacity-70 md:h-10 md:w-[120px] md:gap-3 md:px-3 md:text-base font-['Noto_Sans_TC',sans-serif]"
          >
            {isOrganizing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Archive className="h-4 w-4 md:h-5 md:w-5" />
                <span>整理草稿</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  )
}
