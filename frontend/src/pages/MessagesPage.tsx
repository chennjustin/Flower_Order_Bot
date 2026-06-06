import { useEffect, useMemo, useState } from 'react'
import ChatList from '@/components/messages/ChatList'
import ChatRoom from '@/components/messages/ChatRoom'
import DetailPanel, {
  type DetailPanelSubView,
} from '@/components/messages/DetailPanel'
import OrderSidePanelToggle from '@/components/messages/OrderSidePanelToggle'
import { useChatRooms } from '@/hooks/useChatRooms'
import { useChatRealtime } from '@/hooks/useChatRealtime'
import { useVisibleRoomDeltaSync } from '@/hooks/useVisibleRoomDeltaSync'
import { useOrganizeData } from '@/hooks/useOrderDraft'
import type { ChatRoom as ChatRoomType } from '@/types/domain'

export default function MessagesPage() {
  const roomsQuery = useChatRooms()
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data])

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [openDraftOnDetail, setOpenDraftOnDetail] = useState(false)
  const [detailSubView, setDetailSubView] =
    useState<DetailPanelSubView>('main')

  const organizeMutation = useOrganizeData(selectedRoomId)
  const { sseAvailable } = useChatRealtime(selectedRoomId)
  useVisibleRoomDeltaSync(selectedRoomId, !sseAvailable)
  /** Organize draft is hidden while editing a formal order (use in-panel AI instead). */
  const showOrganizeButton =
    !showDetail || detailSubView !== 'order-edit'

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
    setDetailSubView('main')
  }

  async function handleOrganizeOrder() {
    if (selectedRoomId == null) return
    try {
      await organizeMutation.mutateAsync()
      setOpenDraftOnDetail(true)
      setShowDetail(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`整理資料失敗：${message}`)
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] mt-14 border-b-[1.5px] border-[#e9e9e9]">
      <ChatList
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelect={handleSelect}
        isLoading={roomsQuery.isLoading}
      />
      <div className="relative flex min-w-0 flex-1 flex-col bg-[#f5f5f5]">
        {roomsQuery.error ? (
          <div className="flex flex-1 items-center justify-center text-sm text-red-600">
            無法載入聊天室：{(roomsQuery.error as Error).message}
          </div>
        ) : selectedRoom ? (
          <>
            <ChatRoom
              room={selectedRoom}
              detailPanelOpen={showDetail}
              onOpenDetail={() => setShowDetail(true)}
              onOrganizeOrder={handleOrganizeOrder}
              isOrganizing={organizeMutation.isPending}
              showOrganizeButton={showOrganizeButton}
            />
            {!showDetail && (
              <OrderSidePanelToggle
                mode="open"
                onClick={() => setShowDetail(true)}
              />
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-black/40">
            選擇左側聊天室開始檢視訊息
          </div>
        )}
      </div>
      {showDetail && selectedRoom && (
        <DetailPanel
          roomId={selectedRoom.room_id}
          open={showDetail}
          onClose={() => {
            setShowDetail(false)
            setDetailSubView('main')
          }}
          openDraftInitially={openDraftOnDetail}
          onDraftViewOpened={() => setOpenDraftOnDetail(false)}
          onSubViewChange={setDetailSubView}
        />
      )}
    </div>
  )
}
