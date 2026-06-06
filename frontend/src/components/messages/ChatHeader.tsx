import { Archive, ChevronDown, ClipboardList, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useSwitchChatRoomMode } from '@/hooks/useChatRooms'
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
  onOpenDetail: () => void
  onOrganizeOrder: () => void
  isOrganizing?: boolean
  showOrganizeButton?: boolean
}

export default function ChatHeader({
  roomId,
  roomName,
  avatar,
  status,
  detailPanelOpen,
  onOpenDetail,
  onOrganizeOrder,
  isOrganizing,
  showOrganizeButton = true,
}: ChatHeaderProps) {
  const switchMode = useSwitchChatRoomMode(roomId)
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

  return (
    <header className="flex h-20 items-center border-b-[1.5px] border-[#e9e9e9] bg-white">
      {avatar ? (
        <img
          src={avatar}
          alt={roomName}
          className="ml-[51px] h-14 w-14 flex-shrink-0 rounded-full bg-[#e9e9e9] object-cover"
          onError={e => {
            ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
      ) : (
        <div className="ml-[51px] h-14 w-14 flex-shrink-0 rounded-full bg-[#e9e9e9]" />
      )}

      <div className="ml-4 flex min-w-0 flex-1 items-center gap-4">
        <span className="whitespace-nowrap text-[1.15rem] font-bold text-[#6168FC] font-['Noto_Sans_TC',sans-serif]">
          {roomName}
        </span>
        {status && (
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
        )}
      </div>

      <div className="mr-6 flex flex-shrink-0 items-center gap-3">
        {!detailPanelOpen && (
          <button
            type="button"
            onClick={onOpenDetail}
            className={cn(
              'flex h-10 items-center gap-2 rounded-xl border border-[#C5C7FF] bg-white px-3 text-sm font-bold text-[#6168FC] transition',
              "font-['Noto_Sans_TC',sans-serif]",
              'hover:bg-[#F5F6FF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.12)] active:scale-95',
            )}
            aria-label="開啟訂單詳情"
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            <span>訂單詳情</span>
          </button>
        )}
        {showOrganizeButton && (
          <button
            type="button"
            onClick={onOrganizeOrder}
            disabled={isOrganizing}
            className="flex h-10 w-[120px] items-center justify-center gap-3 rounded-xl bg-[#C5C7FF] px-3 text-base font-bold text-white transition hover:bg-[#A8ACFF] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25)] active:scale-95 disabled:opacity-70 font-['Noto_Sans_TC',sans-serif]"
          >
            {isOrganizing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Archive className="h-5 w-5" />
                <span>整理資料</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  )
}
