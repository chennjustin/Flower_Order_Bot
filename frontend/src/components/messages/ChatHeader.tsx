import { Archive, ChevronsLeft, Loader2 } from 'lucide-react'
import {
  getStatusBadgeClasses,
  getStatusDisplay,
} from '@/utils/statusMapping'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  roomName: string
  avatar?: string | null
  status?: string | null
  onOpenDetail: () => void
  onOrganizeOrder: () => void
  isOrganizing?: boolean
}

export default function ChatHeader({
  roomName,
  avatar,
  status,
  onOpenDetail,
  onOrganizeOrder,
  isOrganizing,
}: ChatHeaderProps) {
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
          <span
            className={cn(
              'flex h-5 flex-shrink-0 items-center justify-center rounded-xl px-3 text-xs font-bold whitespace-nowrap',
              "font-['Noto_Sans_TC',sans-serif]",
              getStatusBadgeClasses(status),
            )}
          >
            {getStatusDisplay(status)}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-black/60 transition hover:text-black"
          aria-label="開啟訂單詳情"
        >
          <ChevronsLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>

      <button
        type="button"
        onClick={onOrganizeOrder}
        disabled={isOrganizing}
        className="mr-6 flex h-10 w-[120px] flex-shrink-0 items-center justify-center gap-3 rounded-xl bg-[#C5C7FF] px-3 text-base font-bold text-white transition hover:shadow-[2px_2px_2px_rgba(0,0,0,0.25)] active:scale-95 disabled:opacity-70 font-['Noto_Sans_TC',sans-serif]"
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
    </header>
  )
}
