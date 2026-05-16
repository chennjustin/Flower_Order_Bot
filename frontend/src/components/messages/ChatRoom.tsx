import ChatHeader from './ChatHeader'
import MessageInput from './MessageInput'
import MessageList from './MessageList'
import { useRoomMessages, useSendMessage } from '@/hooks/useRoomMessages'
import type { ChatRoom as ChatRoomType } from '@/types/domain'
import { ChatMessageStatus } from '@/types/enums'

interface ChatRoomProps {
  room: ChatRoomType
  onOpenDetail: () => void
  onOrganizeOrder: () => void
  isOrganizing?: boolean
}

export default function ChatRoom({
  room,
  onOpenDetail,
  onOrganizeOrder,
  isOrganizing,
}: ChatRoomProps) {
  const messagesQuery = useRoomMessages(room.room_id)
  const sendMutation = useSendMessage(room.room_id)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <ChatHeader
        roomName={room.user_name}
        avatar={room.user_avatar_url ?? null}
        status={room.status}
        onOpenDetail={onOpenDetail}
        onOrganizeOrder={onOrganizeOrder}
        isOrganizing={isOrganizing}
      />
      {messagesQuery.error ? (
        <div className="flex-1 overflow-y-auto bg-white px-6 py-10 text-center text-sm text-red-600">
          無法載入訊息：{(messagesQuery.error as Error).message}
        </div>
      ) : (
        <MessageList messages={messagesQuery.data ?? []} />
      )}
      <MessageInput
        roomId={room.room_id}
        disabled={sendMutation.isPending}
        onSend={async body => {
          try {
            const sent = await sendMutation.mutateAsync(body)
            if (sent.status === ChatMessageStatus.FAILED) {
              alert('訊息已建立，但 LINE 傳送失敗，請確認貼圖 ID 或圖片連結可用後重試。')
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            alert(`送出訊息失敗：${msg}`)
          }
        }}
      />
    </div>
  )
}
