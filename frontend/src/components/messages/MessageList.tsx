import { forwardRef, useMemo } from 'react'
import type { ChatMessageUi } from '@/types/models'
import MessageItem from '@/components/messages/MessageItem'
import './MessageList.css'

interface MessageListProps {
  messages: ChatMessageUi[]
}

type ListEntry =
  | { id: string | number; isDate: true; text: string }
  | (ChatMessageUi & { isFirstInMinute?: boolean })

/** Renders date dividers and Minute-grouping for inbound bubbles (parity with Vue MessageList). */
const MessageList = forwardRef<HTMLDivElement, MessageListProps>(function MessageList(
  { messages },
  ref
) {
  const processed = useMemo(() => {
    const result: ListEntry[] = []
    let lastDate: string | null = null
    messages.forEach((msg, idx, arr) => {
      const msgDate = new Date(msg.timestamp)
      const dateStr = `${msgDate.getMonth() + 1}/${msgDate.getDate()}（${'日一二三四五六'.charAt(msgDate.getDay())}）`
      if (!lastDate || lastDate !== dateStr) {
        result.push({
          id: `date-${dateStr}-${idx}`,
          isDate: true,
          text: dateStr,
        })
        lastDate = dateStr
      }

      let isFirstInMinute = false
      if (msg.direction === 'INCOMING') {
        if (idx === 0) isFirstInMinute = true
        else {
          const prev = arr[idx - 1]
          isFirstInMinute =
            prev.direction !== 'INCOMING' ||
            new Date(msg.timestamp).getMinutes() !== new Date(prev.timestamp).getMinutes()
        }
      }

      result.push({ ...msg, isFirstInMinute })
    })
    return result
  }, [messages])

  return (
    <div className="messages-container" ref={ref}>
      {processed.map((entry) => (
        <MessageItem key={entry.id} message={entry} />
      ))}
    </div>
  )
})

export default MessageList
