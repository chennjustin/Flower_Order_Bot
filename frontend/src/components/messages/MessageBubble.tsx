import { useState } from 'react'
import type { ChatMessage } from '@/types/domain'
import { lineStickerPreviewUrl } from '@/lib/lineStickerPreview'
import { ChatMessageStatus } from '@/types/enums'
import ImageLightbox from './ImageLightbox'

interface MessageBubbleProps {
  message: ChatMessage
  showAvatar: boolean
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** LINE 官方 CDN 預覽（部分動態貼圖可能無法顯示）。 */
export default function MessageBubble({ message, showAvatar }: MessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const text = message.message.text ?? ''
  const img = message.message.image_url?.trim()
  const stickerId = message.message.sticker_id?.trim()
  const isFailed = message.status === ChatMessageStatus.FAILED
  const time = formatTime(message.created_at)

  function openLightbox() {
    if (img) setLightboxOpen(true)
  }

  function onImageKeyDown(e: React.KeyboardEvent<HTMLImageElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openLightbox()
    }
  }

  const bubbleInner = (
    <>
      {stickerId ? (
        <img
          src={lineStickerPreviewUrl(stickerId)}
          alt=""
          className="mx-auto block h-28 w-28 object-contain"
          onError={e => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : null}
      {img ? (
        <img
          src={img}
          alt=""
          role="button"
          tabIndex={0}
          aria-label="View full image"
          className="max-h-52 max-w-full cursor-zoom-in rounded-2xl object-contain transition hover:opacity-90"
          onClick={openLightbox}
          onKeyDown={onImageKeyDown}
          onError={e => {
            ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
      ) : null}
      {text ? <span className="block break-words">{text}</span> : null}
    </>
  )

  const lightbox = img ? (
    <ImageLightbox open={lightboxOpen} imageUrl={img} onOpenChange={setLightboxOpen} />
  ) : null

  if (message.direction === 'INCOMING') {
    return (
      <>
      <div className="mb-3 flex items-end gap-3">
        <div className="flex w-8 flex-shrink-0 items-end justify-center self-end pb-1">
          {showAvatar &&
            (message.user_avatar_url ? (
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
            ))}
        </div>
        <div className="flex max-w-[70%] items-end gap-0.5">
          <div className="space-y-1">
            <div className="inline-block min-h-10 rounded-3xl bg-[#D9D9D9] px-4 py-[9px] font-['Noto_Sans_TC',sans-serif] text-base text-black/[0.87] [line-break:strict] break-words">
              {bubbleInner}
            </div>
            {isFailed ? (
              <div className="text-xs font-['Noto_Sans_TC',sans-serif] text-red-600">
                傳送失敗
              </div>
            ) : null}
          </div>
          <span className="mb-0.5 text-xs text-black/[0.38] font-['Noto_Sans_TC',sans-serif]">{time}</span>
        </div>
      </div>
      {lightbox}
      </>
    )
  }

  return (
    <>
    <div className="mb-3 flex justify-end">
      <div className="flex max-w-[70%] flex-row-reverse items-end gap-0.5">
        <div className="space-y-1 text-left">
          <div className="inline-block min-h-10 rounded-3xl bg-[#77B5FF] px-4 py-[9px] font-['Noto_Sans_TC',sans-serif] text-base text-white [line-break:strict] break-words">
            {bubbleInner}
          </div>
          {isFailed ? (
            <div className="text-xs font-['Noto_Sans_TC',sans-serif] text-red-600">
              傳送失敗
            </div>
          ) : null}
        </div>
        <span className="mb-0.5 text-xs text-black/[0.38] font-['Noto_Sans_TC',sans-serif]">
          {time}
        </span>
      </div>
    </div>
    {lightbox}
    </>
  )
}
