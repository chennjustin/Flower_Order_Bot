import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { readOrderDraft } from '@/api/orders'
import { getLatestMessages } from '@/api/messages'
import ChatListWrapper from '@/components/messages/ChatListWrapper'
import ChatRoom from '@/components/messages/ChatRoom'
import DetailPanel from '@/components/messages/DetailPanel'
import type { ChatRoomUi } from '@/types/models'
import './MessagesPage.css'

export default function MessagesPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)

  const chatRoomsQuery = useQuery({
    queryKey: ['chatRooms'],
    queryFn: getLatestMessages,
    refetchInterval: 5000,
  })

  const selectedRoom: ChatRoomUi | null = useMemo(() => {
    const list = chatRoomsQuery.data ?? []
    if (!list.length) return null
    if (!selectedId) return list[0]!
    return list.find((r) => String(r.id) === selectedId) ?? list[0]!
  }, [chatRoomsQuery.data, selectedId])

  const orderDraftQuery = useQuery({
    queryKey: ['orderDraft', selectedRoom?.id],
    queryFn: () => readOrderDraft(selectedRoom!.id),
    enabled: Boolean(selectedRoom?.id),
  })

  function selectRoom(room: ChatRoomUi) {
    setSelectedId(room.id)
    setShowDetailPanel(false)
    void qc.invalidateQueries({ queryKey: ['orderDraft', room.id] })
  }

  function openDetailPanel() {
    setShowDetailPanel(true)
  }

  function onDraftLoadedFromHeader(data: Record<string, unknown>) {
    if (selectedRoom) qc.setQueryData(['orderDraft', selectedRoom.id], data)
  }

  async function handleOrderDraftUpdatedFlow() {
    if (!selectedRoom) return
    await qc.invalidateQueries({ queryKey: ['orderDraft', selectedRoom.id] })
    void qc.invalidateQueries({ queryKey: ['chatRooms'] })
    void qc.invalidateQueries({ queryKey: ['orders'] })
  }

  const draftRow =
    orderDraftQuery.data && typeof orderDraftQuery.data === 'object'
      ? (orderDraftQuery.data as Record<string, unknown>)
      : null

  return (
    <div className="msgs-layout">
      <div className="msgs-list-pane">
        <ChatListWrapper
          chatRooms={chatRoomsQuery.data ?? []}
          selectedRoomId={selectedRoom?.id}
          onSelectRoom={selectRoom}
        />
      </div>

      {selectedRoom ? (
        <div className={`msgs-room-pane${showDetailPanel ? '' : ' expanded'}`}>
          <ChatRoom
            roomId={selectedRoom.id}
            roomName={selectedRoom.name}
            avatar={selectedRoom.avatar}
            status={selectedRoom.status}
            showDetail={showDetailPanel}
            openDetailPanel={openDetailPanel}
            onDraftLoaded={onDraftLoadedFromHeader}
          />
        </div>
      ) : null}

      {selectedRoom && showDetailPanel ? (
        <DetailPanel
          orderData={draftRow}
          roomId={selectedRoom.id}
          onClose={() => setShowDetailPanel(false)}
          onOrderDraftUpdated={handleOrderDraftUpdatedFlow}
        />
      ) : null}
    </div>
  )
}
