import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import OrderSidePanelToggle from './OrderSidePanelToggle'
import { useOrderDraft } from '@/hooks/useOrderDraft'
import { useRoomOrders } from '@/hooks/useRoomOrders'
import OrderDraftPanel from './OrderDraftPanel'
import OrderEditPanel from './OrderEditPanel'
import RoomOrderList from './RoomOrderList'
import type { Order } from '@/types/domain'
import { cn } from '@/lib/utils'

/** Right-panel sub-view; used to toggle chat-header actions (e.g. organize draft). */
export type DetailPanelSubView = 'main' | 'draft' | 'order-edit'

interface DetailPanelProps {
  roomId: number
  open: boolean
  onClose: () => void
  /** Open the draft sub-view when the panel mounts (e.g. after organize data). */
  openDraftInitially?: boolean
  onDraftViewOpened?: () => void
  onSubViewChange?: (view: DetailPanelSubView) => void
}

export default function DetailPanel({
  roomId,
  open,
  onClose,
  openDraftInitially,
  onDraftViewOpened,
  onSubViewChange,
}: DetailPanelProps) {
  const [showDraftPanel, setShowDraftPanel] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const subViewOpen = showDraftPanel || editingOrder != null
  const draftQuery = useOrderDraft(roomId, open && !subViewOpen)
  const roomOrdersQuery = useRoomOrders(roomId, open && !subViewOpen)

  const draft = draftQuery.data ?? null

  useEffect(() => {
    setShowDraftPanel(false)
    setEditingOrder(null)
  }, [roomId])

  useEffect(() => {
    if (open && openDraftInitially) {
      setShowDraftPanel(true)
      onDraftViewOpened?.()
    }
  }, [open, openDraftInitially, onDraftViewOpened, roomId])

  useEffect(() => {
    if (!open) return
    const view: DetailPanelSubView = editingOrder
      ? 'order-edit'
      : showDraftPanel
        ? 'draft'
        : 'main'
    onSubViewChange?.(view)
  }, [open, editingOrder, showDraftPanel, onSubViewChange])

  const draftSummary = useMemo(() => {
    if (draftQuery.isLoading) return '載入中...'
    if (draftQuery.error) return '載入失敗'
    if (!draft) return '空白草稿'
    if (draft.item) return draft.item
    return '草稿已建立'
  }, [draft, draftQuery.error, draftQuery.isLoading])

  if (showDraftPanel) {
    return (
      <OrderDraftPanel
        roomId={roomId}
        open={open}
        onBack={() => setShowDraftPanel(false)}
        onClosePanel={onClose}
      />
    )
  }

  if (editingOrder) {
    return (
      <OrderEditPanel
        roomId={roomId}
        order={editingOrder}
        onBack={() => setEditingOrder(null)}
        onClosePanel={onClose}
        onOrderUpdated={setEditingOrder}
      />
    )
  }

  return (
    <aside className="relative flex h-full w-[336px] flex-shrink-0 flex-col border-l border-[#B3B3B3] bg-white">
      <OrderSidePanelToggle mode="close" onClick={onClose} />

      <header className="flex h-20 flex-shrink-0 items-center border-b-[1.5px] border-[#e9e9e9] px-6">
        <span className="text-lg font-bold text-black font-['Noto_Sans_TC',sans-serif]">
          訂單詳情
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <button
          type="button"
          onClick={() => setShowDraftPanel(true)}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border border-[#e9e9e9] bg-[#FAFAFA] px-4 py-3 text-left transition',
            'hover:border-[#C5C7FF] hover:bg-[#F5F6FF] active:scale-[0.99]',
          )}
        >
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'text-base font-bold text-black',
                "font-['Noto_Sans_TC',sans-serif]",
              )}
            >
              訂單草稿
            </div>
            <div
              className={cn(
                'mt-0.5 truncate text-sm text-black/50',
                "font-['Noto_Sans_TC',sans-serif]",
              )}
            >
              {draftSummary}
            </div>
          </div>
          <ChevronRight
            className="h-5 w-5 flex-shrink-0 text-black/40"
            aria-hidden
          />
        </button>

        <RoomOrderList
          orders={roomOrdersQuery.data ?? []}
          isLoading={roomOrdersQuery.isLoading}
          error={roomOrdersQuery.error as Error | null}
          onSelectOrder={setEditingOrder}
        />
      </div>
    </aside>
  )
}
