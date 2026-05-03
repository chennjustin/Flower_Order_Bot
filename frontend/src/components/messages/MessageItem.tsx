import type { SyntheticEvent } from 'react'
import { format } from 'date-fns'
import type { ChatMessageUi } from '@/types/models'
import './MessageItem.css'

type MessageItemProps = {
  message:
    | ChatMessageUi
    | { isDate?: true; text: string; id: string | number }
    | (ChatMessageUi & { isFirstInMinute?: boolean })
}

export default function MessageItem({ message }: MessageItemProps) {
  if ('isDate' in message && message.isDate) {
    return (
      <div className="date-block">
        <span className="date-text">{message.text}</span>
      </div>
    )
  }

  const msg = message as ChatMessageUi & { isFirstInMinute?: boolean }

  function formatTime(timestamp: Date | string) {
    return format(new Date(timestamp), 'HH:mm')
  }

  function onImgError(event: SyntheticEvent<HTMLImageElement>) {
    event.currentTarget.src = ''
  }

  if (msg.direction === 'INCOMING') {
    return (
      <div className="message-customer">
        <div className="avatar-slot">
          {msg.isFirstInMinute ? (
            <img className="pic" src={msg.avatar || ''} alt={msg.sender} onError={onImgError} />
          ) : null}
        </div>
        <div className="message-bubble">
          <div className="sender">
            <span className="message-text">{msg.text}</span>
          </div>
          <span className="time">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="message-myself">
      <div className="message-bubble">
        <div className="sender myself">
          <span className="message-text">{msg.text}</span>
        </div>
        <span className="time myself">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  )
}
