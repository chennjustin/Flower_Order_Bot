import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import OrderFormCard from './OrderFormCard'
import { useUpdateOrder } from '@/hooks/useOrders'
import type { Order } from '@/types/domain'

interface OrderDetailDialogProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function OrderDetailDialog({
  order,
  open,
  onOpenChange,
}: OrderDetailDialogProps) {
  const [current, setCurrent] = useState<Order | null>(null)
  const updateOrder = useUpdateOrder()

  const displayed = current ?? order

  function handleOpenChange(next: boolean) {
    if (!next) setCurrent(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        overlayClassName="z-[1100] bg-black/25 backdrop-blur-lg"
        className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none outline-none"
      >
        <DialogTitle className="sr-only">
          {displayed ? `訂單 ${displayed.id}` : '訂單詳情'}
        </DialogTitle>
        {displayed && (
          <OrderFormCard
            mode="edit"
            order={displayed}
            onClose={() => handleOpenChange(false)}
            onSave={async patch => {
              const updated = await updateOrder.mutateAsync({ orderId: displayed.id, patch })
              setCurrent(updated)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
