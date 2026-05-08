import { useEffect, useMemo, useRef } from 'react'
import type { ChatMessage } from '@/types/domain'
import MessageBubble from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
}

interface DateMarker {
  kind: 'date'
  id: string
  text: string
}

interface BubbleEntry {
  kind: 'bubble'
  id: string
  message: ChatMessage
  showAvatar: boolean
}

const WEEKDAYS_ZH = '日一二三四五六'

function dateBucket(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS_ZH[d.getDay()]}）`
}

export default function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const entries = useMemo<Array<DateMarker | BubbleEntry>>(() => {
    const out: Array<DateMarker | BubbleEntry> = []
    let lastBucket: string | null = null

    messages.forEach((msg, idx) => {
      const bucket = dateBucket(msg.created_at)
      if (bucket !== lastBucket) {
        out.push({
          kind: 'date',
          id: `date-${bucket}-${idx}`,
          text: bucket,
        })
        lastBucket = bucket
      }

      let showAvatar = false
      if (msg.direction === 'INCOMING') {
        if (idx === 0) {
          showAvatar = true
        } else {
          const prev = messages[idx - 1]
          const prevMinute = new Date(prev.created_at).getMinutes()
          const currMinute = new Date(msg.created_at).getMinutes()
          showAvatar = prev.direction !== 'INCOMING' || prevMinute !== currMinute
        }
      }

      out.push({
        kind: 'bubble',
        id: `bubble-${msg.id}`,
        message: msg,
        showAvatar,
      })
    })

    return out
  }, [messages])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-white px-6 py-6"
    >
      {entries.map(entry =>
        entry.kind === 'date' ? (
          <div key={entry.id} className="mb-3 flex justify-center">
            <span className="rounded-lg bg-[#C5C7FF] px-2 py-0.5 text-sm text-white font-['Noto_Sans_TC',sans-serif]">
              {entry.text}
            </span>
          </div>
        ) : (
          <MessageBubble
            key={entry.id}
            message={entry.message}
            showAvatar={entry.showAvatar}
          />
        ),
      )}
    </div>
  )
}
