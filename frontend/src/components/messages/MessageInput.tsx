import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import type { ChatMessageBody } from '@/types/domain'
import { uploadStaffChatImage } from '@/api/messages'
import {
  LINE_PRESET_STICKERS,
  lineStickerPreviewUrl,
} from '@/lib/lineStickerPreview'

type SendMode = 'text' | 'image' | 'sticker'

interface MessageInputProps {
  roomId: number
  disabled?: boolean
  onSend: (body: ChatMessageBody) => void | Promise<void>
}

export default function MessageInput({ roomId, disabled, onSend }: MessageInputProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<SendMode>('text')
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const busy = disabled || uploading

  function clearImage() {
    setImageUrl('')
    setMode('text')
  }

  /** Dismiss attach UI and return to plain text input (tap-outside / Escape). */
  function returnToTextMode() {
    setShowAttachMenu(false)
    setImageUrl('')
    setMode('text')
  }

  async function emitSend() {
    if (busy) return

    let body: ChatMessageBody
    if (mode === 'text') {
      const t = text.trim()
      if (!t) return
      body = { text: t }
      setText('')
    } else if (mode === 'image') {
      const u = imageUrl.trim()
      if (!u) return
      body = { image_url: u }
      clearImage()
    } else {
      return
    }

    await onSend(body)
  }

  async function onPickLocalImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || busy) return
    setUploading(true)
    try {
      const { image_url } = await uploadStaffChatImage(roomId, file)
      setImageUrl(image_url)
      setMode('image')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`上傳失敗：${msg}`)
    } finally {
      setUploading(false)
    }
  }

  async function sendPresetSticker(packageId: string, stickerId: string) {
    if (busy) return
    await onSend({ sticker_package_id: packageId, sticker_id: stickerId })
  }

  function openImagePicker() {
    setShowAttachMenu(false)
    fileRef.current?.click()
  }

  useEffect(() => {
    const attachUiOpen = showAttachMenu || mode !== 'text'
    if (!attachUiOpen) return

    function onDocumentPointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        returnToTextMode()
      }
    }

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        returnToTextMode()
      }
    }

    document.addEventListener('pointerdown', onDocumentPointerDown)
    document.addEventListener('keydown', onDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      document.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [showAttachMenu, mode])

  return (
    <div ref={rootRef} className="relative space-y-2 px-6 pb-6 pt-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        disabled={busy}
        onChange={e => void onPickLocalImage(e)}
      />

      {showAttachMenu ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-black/[0.08] bg-black/[0.02] p-2 text-xs font-['Noto_Sans_TC',sans-serif]">
          <button
            type="button"
            disabled={busy}
            onClick={openImagePicker}
            className="rounded-full bg-[#77B5FF]/10 px-2 py-1 text-[#528DD2] transition hover:bg-[#77B5FF]/20"
          >
            上傳圖片
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode('sticker')
              setShowAttachMenu(false)
            }}
            className="rounded-full bg-[#77B5FF]/10 px-2 py-1 text-[#528DD2] transition hover:bg-[#77B5FF]/20"
          >
            選擇貼圖
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              returnToTextMode()
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="rounded-full bg-black/[0.06] px-2 py-1 text-black/[0.65] transition hover:bg-black/[0.1]"
          >
            回到文字輸入
          </button>
        </div>
      ) : null}

      {mode === 'sticker' ? (
        <div className="space-y-2">
          <p className="text-xs text-black/[0.45] font-['Noto_Sans_TC',sans-serif]">
            點一下貼圖即可送出：
          </p>
          <div className="flex max-h-[116px] flex-wrap gap-2 overflow-y-auto rounded-xl border border-black/[0.06] bg-black/[0.02] p-2">
            {LINE_PRESET_STICKERS.map(s => (
              <button
                key={`${s.packageId}-${s.stickerId}`}
                type="button"
                disabled={busy}
                title={s.label}
                onClick={() => void sendPresetSticker(s.packageId, s.stickerId)}
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm transition hover:ring-2 hover:ring-[#77B5FF]/60 disabled:opacity-40"
              >
                <img
                  src={lineStickerPreviewUrl(s.stickerId)}
                  alt={s.label}
                  className="h-11 w-11 object-contain"
                  onError={e => {
                    ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="flex min-h-[42px] w-full cursor-text items-center justify-between rounded-3xl border-2 border-[#77B5FF] bg-white px-4 py-[9px] shadow-[2px_2px_4px_rgba(0,0,0,0.25)] transition focus-within:shadow-[0_0_0_3px_rgba(119,181,255,0.25)]"
        onClick={() => mode === 'text' && inputRef.current?.focus()}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={e => {
              e.stopPropagation()
              setShowAttachMenu(v => !v)
            }}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[#528DD2] transition hover:text-[#6168FC] active:scale-90 disabled:opacity-40"
            aria-label="附件選單"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          {mode === 'text' ? (
            <input
              ref={inputRef}
              type="text"
              value={text}
              disabled={busy}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void emitSend()
              }}
              placeholder="輸入訊息......"
              className="w-full border-0 bg-transparent p-0 font-['Noto_Sans_TC',sans-serif] text-base leading-[140%] text-black/[0.87] outline-none placeholder:text-black/[0.38]"
            />
          ) : mode === 'image' ? (
            uploading ? (
              <span className="font-['Noto_Sans_TC',sans-serif] text-sm text-black/[0.38]">
                圖片上傳中…
              </span>
            ) : imageUrl ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <img
                  src={imageUrl}
                  alt=""
                  className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                />
                <span className="truncate font-['Noto_Sans_TC',sans-serif] text-sm text-black/[0.55]">
                  已選擇圖片，按送出傳給顧客
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={e => {
                    e.stopPropagation()
                    clearImage()
                  }}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-black/[0.38] transition hover:text-black/[0.65]"
                  aria-label="移除圖片"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <span className="font-['Noto_Sans_TC',sans-serif] text-sm text-black/[0.38]">
                請從附件選單選擇圖片
              </span>
            )
          ) : (
            <span className="font-['Noto_Sans_TC',sans-serif] text-sm text-black/[0.38]">
              點上方貼圖即可送出
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void emitSend()}
          disabled={
            busy ||
            mode === 'sticker' ||
            (mode === 'text' && text.trim().length === 0) ||
            (mode === 'image' && imageUrl.trim().length === 0)
          }
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[#528DD2] transition hover:text-[#6168FC] active:scale-90 disabled:opacity-40"
          aria-label="送出"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
