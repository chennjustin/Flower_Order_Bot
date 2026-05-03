import { useRef } from 'react'
import './MessageInput.css'

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
}

/** Controlled composer (parity with Vue v-model behaviour without mirroring state in an effect). */
export default function MessageInput({ value, onChange, onSend }: MessageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function emitSend() {
    if (!value.trim()) return
    onSend()
  }

  return (
    <div className="msg-input-wrap">
      <div className="input-container">
        <div
          className="textbar"
          role="presentation"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="textbar-inner">
            <i className="fas fa-paperclip attach-icon" />
            <input
              ref={inputRef}
              className="message-input"
              placeholder="輸入訊息......"
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === 'Enter') emitSend()
              }}
            />
          </div>
          <div className="send" role="presentation" onClick={emitSend}>
            <i className="fas fa-paper-plane send-icon" />
          </div>
        </div>
      </div>
    </div>
  )
}
