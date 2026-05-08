import type { ChatMessage } from '@/types/domain'

interface MessageBubbleProps {
  message: ChatMessage
  showAvatar: boolean
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function MessageBubble({ message, showAvatar }: MessageBubbleProps) {
  const text = message.message.text ?? ''
  const time = formatTime(message.created_at)

  if (message.direction === 'INCOMING') {
    return (
      <div className="mb-3 flex items-end gap-3">
        <div className="flex w-8 flex-shrink-0 items-end justify-center self-end pb-1">
          {showAvatar && (
            message.user_avatar_url ? (
              <img
                src={message.user_avatar_url}
                alt=""
                className="h-8 w-8 rounded-full bg-[#D9D9D9] object-cover"
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#D9D9D9]" />
            )
          )}
        </div>
        <div className="flex max-w-[360px] items-end gap-0.5">
          <div className="inline-block min-h-10 rounded-3xl bg-[#D9D9D9] px-4 py-[9px] break-words font-['Noto_Sans_TC',sans-serif] text-base text-black/[0.87]">
            {text}
          </div>
          <span className="mb-0.5 text-xs text-black/[0.38] font-['Noto_Sans_TC',sans-serif]">
            {time}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3 flex justify-end">
      <div className="flex max-w-[360px] flex-row-reverse items-end gap-0.5">
        <div className="inline-block min-h-10 rounded-3xl bg-[#77B5FF] px-4 py-[9px] break-words font-['Noto_Sans_TC',sans-serif] text-base text-white">
          {text}
        </div>
        <span className="mb-0.5 text-xs text-black/[0.38] font-['Noto_Sans_TC',sans-serif]">
          {time}
        </span>
      </div>
    </div>
  )
}
