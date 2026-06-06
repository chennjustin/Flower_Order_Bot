import { useRef, useEffect, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import OrderTable from '@/components/orders/OrderTable'
import OrderDetailDialog from '@/components/orders/OrderDetailDialog'
import OrderFormCard from '@/components/orders/OrderFormCard'
import PageHeader from '@/components/layout/PageHeader'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useCreateOrderDirect } from '@/hooks/useOrders'
import type { Order } from '@/types/domain'

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(() => searchParams.get('create') === '1')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const isDirtyRef = useRef(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const createOrder = useCreateOrderDirect()

  const blocker = useBlocker(() => isDirtyRef.current)

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the leave guard when the create dialog closes (form data may still be dirty briefly on unmount).
  useEffect(() => {
    if (!showCreate) {
      isDirtyRef.current = false
    }
  }, [showCreate])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  function tryAction(action: () => void) {
    if (isDirtyRef.current) {
      pendingActionRef.current = action
      setShowLeaveDialog(true)
      return
    }
    action()
  }

  function handleLeaveConfirm() {
    isDirtyRef.current = false
    setShowLeaveDialog(false)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (blocker.state === 'blocked') {
      blocker.proceed()
    } else {
      action?.()
    }
  }

  function handleLeaveCancel() {
    setShowLeaveDialog(false)
    pendingActionRef.current = null
    if (blocker.state === 'blocked') blocker.reset()
  }

  return (
    <>
      <PageHeader title="訂單管理" />
      <div className="mx-auto max-w-[1280px] px-2 pt-[160px] pb-8">
        <OrderTable
          showTitle={false}
          pageSize={10}
          onSelectOrder={order => tryAction(() => setSelectedOrder(order))}
          onCreateOrder={() => tryAction(() => setShowCreate(true))}
        />
      </div>

      <OrderDetailDialog
        order={selectedOrder}
        open={selectedOrder !== null}
        onOpenChange={open => { if (!open) { isDirtyRef.current = false; setSelectedOrder(null) } }}
        onDirtyChange={dirty => { isDirtyRef.current = dirty }}
      />

      <Dialog
        open={showCreate}
        onOpenChange={open => { if (!open && !isDirtyRef.current) setShowCreate(false) }}
      >
        <DialogContent
          hideClose
          overlayClassName="z-[1100] bg-black/25 backdrop-blur-lg"
          className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none outline-none"
          onPointerDownOutside={e => e.preventDefault()}
          onInteractOutside={e => e.preventDefault()}
        >
          <DialogTitle className="sr-only">新增訂單</DialogTitle>
          <OrderFormCard
            mode="create"
            onDirtyChange={dirty => { isDirtyRef.current = dirty }}
            onClose={() => { isDirtyRef.current = false; setShowCreate(false) }}
            onSave={async patch => {
              await createOrder.mutateAsync(patch)
              isDirtyRef.current = false
              setShowCreate(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaveDialog || blocker.state === 'blocked'} onOpenChange={() => {}}>
        <DialogContent
          hideClose
          overlayClassName="z-[9998] bg-black/30"
          className="z-[9999] w-[280px] rounded-2xl border-0 px-6 py-5 shadow-xl"
          onPointerDownOutside={e => e.preventDefault()}
          onInteractOutside={e => e.preventDefault()}
        >
          <DialogTitle className="sr-only">確定要離開？</DialogTitle>
          <p className="mb-1 text-base font-bold text-black font-['Noto_Sans_TC',sans-serif]">確定要離開？</p>
          <p className="mb-5 text-sm text-black/50 font-['Noto_Sans_TC',sans-serif]">尚未儲存的變更將會遺失。</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLeaveCancel}
              className="flex h-10 flex-1 items-center justify-center rounded-xl border border-[#e0e3ed] text-sm font-bold text-black/60 transition hover:bg-[#F5F5F5] font-['Noto_Sans_TC',sans-serif] outline-none"
            >
              繼續編輯
            </button>
            <button
              type="button"
              onClick={handleLeaveConfirm}
              className="flex h-10 flex-1 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white transition hover:bg-red-600 font-['Noto_Sans_TC',sans-serif]"
            >
              離開
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
