import { useEffect, useMemo, useState } from 'react'
import ChatList from '@/components/messages/ChatList'
import ChatRoom from '@/components/messages/ChatRoom'
import { useChatRooms } from '@/hooks/useChatRooms'
import type { ChatRoom as ChatRoomType } from '@/types/domain'

export default function MessagesPage() {
  const roomsQuery = useChatRooms()
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data])

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (rooms.length === 0) {
      if (selectedRoomId !== null) setSelectedRoomId(null)
      return
    }
    const stillExists = rooms.some(r => r.room_id === selectedRoomId)
    if (!stillExists) {
      setSelectedRoomId(rooms[0].room_id)
    }
  }, [rooms, selectedRoomId])

  const selectedRoom: ChatRoomType | null =
    rooms.find(r => r.room_id === selectedRoomId) ?? null

  function handleSelect(room: ChatRoomType) {
    setSelectedRoomId(room.room_id)
    setShowDetail(false)
  }

  return (
    <div className="flex h-[calc(100vh-56px)] mt-14 border-b-[1.5px] border-[#e9e9e9]">
      <ChatList
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelect={handleSelect}
        isLoading={roomsQuery.isLoading}
      />
      <div className="flex flex-1 flex-col bg-[#f5f5f5]">
        {roomsQuery.error ? (
          <div className="flex flex-1 items-center justify-center text-sm text-red-600">
            無法載入聊天室：{(roomsQuery.error as Error).message}
          </div>
        ) : selectedRoom ? (
          <ChatRoom
            room={selectedRoom}
            onOpenDetail={() => setShowDetail(true)}
            onOrganizeOrder={() => setShowDetail(true)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-black/40">
            選擇左側聊天室開始檢視訊息
          </div>
        )}
      </div>
      {showDetail && selectedRoom && (
        <aside className="w-[340px] overflow-y-auto border-l border-[#e9e9e9] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#6168FC] font-['Noto_Sans_TC',sans-serif]">
              訂單詳情
            </h2>
            <button
              type="button"
              onClick={() => setShowDetail(false)}
              className="text-sm text-black/60 hover:text-black"
            >
              收起
            </button>
          </div>
          <div className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            (Order draft details arrive in Step 7.)
          </div>
        </aside>
      )}
    </div>
  )
}
