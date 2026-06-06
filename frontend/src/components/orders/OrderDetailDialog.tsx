import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import OrderFormCard from './OrderFormCard'
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        overlayClassName="z-[1100] bg-black/25 backdrop-blur-lg"
        className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none outline-none"
      >
        <DialogTitle className="sr-only">
          {order ? `訂單 ${order.id}` : '訂單詳情'}
        </DialogTitle>
        <OrderFormCard
          mode="view"
          order={order}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
