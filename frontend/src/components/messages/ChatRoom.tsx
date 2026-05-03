import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRoomMessagesRaw, mapRoomMessagesApiToUi, sendRoomMessage } from '@/api/messages'
import ChatHeader from '@/components/messages/ChatHeader'
import MessageList from '@/components/messages/MessageList'
import MessageInput from '@/components/messages/MessageInput'
import './ChatRoom.css'

interface ChatRoomProps {
  roomId: string
  roomName: string
  avatar: string
  status: string
  showDetail: boolean
  onDraftLoaded: (data: Record<string, unknown>) => void
  openDetailPanel: () => void
}

export default function ChatRoom({
  roomId,
  roomName,
  avatar,
  status,
  showDetail,
  onDraftLoaded,
  openDetailPanel,
}: ChatRoomProps) {
  const qc = useQueryClient()
  const listRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')

  const messagesQuery = useQuery({
    queryKey: ['roomMessages', roomId],
    queryFn: async () => {
      const raw = await getRoomMessagesRaw(roomId)
      return mapRoomMessagesApiToUi(raw, roomName)
    },
    refetchInterval: 10000,
  })

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messagesQuery.data])

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendRoomMessage(roomId, text),
    onSuccess: async () => {
      setDraft('')
      await qc.invalidateQueries({ queryKey: ['roomMessages', roomId] })
    },
  })

  function handleSend() {
    const t = draft.trim()
    if (!t || sendMutation.isPending) return
    sendMutation.mutate(t)
  }

  return (
    <div className={`chat-room-root${showDetail ? ' shrink' : ''}`}>
      <ChatHeader
        roomName={roomName}
        avatar={avatar}
        status={status}
        roomId={roomId}
        openDetailPanel={openDetailPanel}
        onDraftLoaded={onDraftLoaded}
      />
      <div className="message-list-container">
        <MessageList ref={listRef} messages={messagesQuery.data ?? []} />
      </div>
      <MessageInput value={draft} onChange={setDraft} onSend={handleSend} />
    </div>
  )
}
