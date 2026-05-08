import { useRef, useState } from 'react'
import { Paperclip, Send } from 'lucide-react'

interface MessageInputProps {
  disabled?: boolean
  onSend: (text: string) => void | Promise<void>
}

export default function MessageInput({ disabled, onSend }: MessageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

  function emitSend() {
    const text = value.trim()
    if (!text || disabled) return
    setValue('')
    void onSend(text)
  }

  return (
    <div className="relative px-6 pb-6">
      <div
        className="flex h-[42px] w-full cursor-text items-center justify-between rounded-3xl border-2 border-[#77B5FF] bg-white px-4 py-[9px] shadow-[2px_2px_4px_rgba(0,0,0,0.25)] transition focus-within:shadow-[0_0_0_3px_rgba(119,181,255,0.25)]"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-1 items-center gap-3">
          <Paperclip className="h-5 w-5 flex-shrink-0 text-[#528DD2]" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            disabled={disabled}
            onChange={e => setValue(e.target.value)}
            onKeyUp={e => {
              if (e.key === 'Enter') emitSend()
            }}
            placeholder="輸入訊息......"
            className="w-full border-0 bg-transparent p-0 font-['Noto_Sans_TC',sans-serif] text-base leading-[140%] text-black/[0.87] outline-none placeholder:text-black/[0.38]"
          />
        </div>
        <button
          type="button"
          onClick={emitSend}
          disabled={disabled || value.trim().length === 0}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[#528DD2] transition hover:text-[#6168FC] active:scale-90 disabled:opacity-40"
          aria-label="送出"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
