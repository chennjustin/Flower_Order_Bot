import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import ChatList from '@/components/messages/ChatList'
import ChatRoom from '@/components/messages/ChatRoom'
import DetailPanel, {
  type DetailPanelSubView,
} from '@/components/messages/DetailPanel'
import { useStore } from '@/context/StoreContext'
import {
  flattenChatRoomPages,
  getChatRoomsFilteredUnreadRooms,
  useMarkRoomRead,
  useChatRooms,
  type ChatRoomsFilter,
} from '@/hooks/useChatRooms'
import { useChatRealtime } from '@/hooks/useChatRealtime'
import { useVisibleRoomDeltaSync } from '@/hooks/useVisibleRoomDeltaSync'
import { useOrganizeData } from '@/hooks/useOrderDraft'
import { clearRoomUnread } from '@/utils/chatRoomCache'
import type { ChatRoom as ChatRoomType } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'
import { useQueryClient } from '@tanstack/react-query'

export default function MessagesPage() {
  const qc = useQueryClient()
  const { currentStoreId } = useStore()
  const [roomFilters, setRoomFilters] = useState<ChatRoomsFilter>({
    stage: 'ALL',
    q: '',
  })
  const roomsQuery = useChatRooms(roomFilters)
  const markRoomReadMutation = useMarkRoomRead(roomFilters)
  const rooms = useMemo(
    () => flattenChatRoomPages(roomsQuery.data),
    [roomsQuery.data],
  )

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [openDraftOnDetail, setOpenDraftOnDetail] = useState(false)
  const [detailSubView, setDetailSubView] = useState<DetailPanelSubView>('main')
  const [draftAiChangedFields, setDraftAiChangedFields] = useState<string[]>([])
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const pendingRoomRef = useRef<ChatRoomType | null>(null)
  const isDirtyRef = useRef(false)

  const handleDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty
  }, [])

  const blocker = useBlocker(() => isDirtyRef.current)

  const organizeMutation = useOrganizeData(selectedRoomId)
  const { sseAvailable } = useChatRealtime(currentStoreId, selectedRoomId)
  useVisibleRoomDeltaSync(currentStoreId, selectedRoomId, !sseAvailable)
  /** Organize draft is hidden while editing a formal order (use in-panel AI instead). */
  const showOrganizeButton =
    !showDetail || detailSubView !== 'order-edit'

  // Clear selection when switching stores so we do not show another store's room.
  useEffect(() => {
    setSelectedRoomId(null)
    setShowDetail(false)
    setDraftAiChangedFields([])
  }, [currentStoreId])

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

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  function handleSelect(room: ChatRoomType) {
    if (isDirtyRef.current) {
      pendingRoomRef.current = room
      setShowLeaveDialog(true)
      return
    }
    doSelect(room)
  }

  function doSelect(room: ChatRoomType) {
    setSelectedRoomId(room.room_id)
    if (currentStoreId != null) {
      clearRoomUnread(qc, currentStoreId, room.room_id)
    }
    markRoomReadMutation.mutate(room.room_id)
    setShowDetail(false)
    setDetailSubView('main')
    setDraftAiChangedFields([])
    isDirtyRef.current = false
  }

  async function handleOrganizeOrder() {
    if (selectedRoomId == null) return
    try {
      const result = await organizeMutation.mutateAsync()
      setDraftAiChangedFields(result.changed_fields)
      setOpenDraftOnDetail(true)
      setShowDetail(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`整理資料失敗：${message}`)
    }
  }

  function handleStageChange(stage: ChatRoomStage | 'ALL') {
    setRoomFilters(prev => ({ ...prev, stage }))
  }

  function handleSearchChange(q: string) {
    setRoomFilters(prev => ({ ...prev, q }))
  }

  return (
    <div className="box-border flex h-screen pt-14 border-b-[1.5px] border-[#e9e9e9]">
      <ChatList
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelect={handleSelect}
        isLoading={roomsQuery.isLoading}
        isFetchingMore={roomsQuery.isFetchingNextPage}
        hasMore={roomsQuery.hasNextPage ?? false}
        onLoadMore={() => {
          if (roomsQuery.hasNextPage && !roomsQuery.isFetchingNextPage) {
            void roomsQuery.fetchNextPage()
          }
        }}
        totalUnread={getChatRoomsFilteredUnreadRooms(roomsQuery.data)}
        currentStage={roomFilters.stage}
        onStageChange={handleStageChange}
        searchQuery={roomFilters.q}
        onSearchChange={handleSearchChange}
        storeId={currentStoreId}
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
              roomFilters={roomFilters}
            />
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
          onDirtyChange={handleDirtyChange}
          draftAiChangedFields={draftAiChangedFields}
          onDraftAiHighlightClear={() => setDraftAiChangedFields([])}
        />
      )}

      {(showLeaveDialog || blocker.state === 'blocked') && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/30">
          <div className="w-[280px] rounded-2xl bg-white px-6 py-5 shadow-xl font-['Noto_Sans_TC',sans-serif]">
            <p className="mb-1 text-base font-bold text-black">確定要離開？</p>
            <p className="mb-5 text-sm text-black/50">尚未儲存的變更將會遺失。</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowLeaveDialog(false)
                  pendingRoomRef.current = null
                  if (blocker.state === 'blocked') blocker.reset()
                }}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-[#e0e3ed] text-sm font-bold text-black/60 transition hover:bg-[#F5F5F5]"
              >
                繼續編輯
              </button>
              <button
                type="button"
                onClick={() => {
                  isDirtyRef.current = false
                  setShowLeaveDialog(false)
                  const pending = pendingRoomRef.current
                  pendingRoomRef.current = null
                  if (blocker.state === 'blocked') {
                    blocker.proceed()
                  } else if (pending) {
                    doSelect(pending)
                  }
                }}
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white transition hover:bg-red-600"
              >
                離開
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
