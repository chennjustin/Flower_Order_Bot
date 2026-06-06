import type { Order } from '@/types/domain'
import { formatCellDateTime } from '@/utils/datetime'
import {
  normalizeOrderStatus,
  orderStatusBadgeClasses,
  orderStatusLabel,
} from '@/utils/orderStatus'
import { cn } from '@/lib/utils'

interface RoomOrderListProps {
  orders: Order[]
  isLoading: boolean
  error: Error | null
  onSelectOrder: (order: Order) => void
}

export default function RoomOrderList({
  orders,
  isLoading,
  error,
  onSelectOrder,
}: RoomOrderListProps) {
  return (
    <section className="mt-6 border-t border-[#e9e9e9] pt-6">
      <h3
        className={cn(
          'mb-4 text-base font-bold text-black',
          "font-['Noto_Sans_TC',sans-serif]",
        )}
      >
        現有訂單
      </h3>

      {isLoading ? (
        <p className="py-2 text-sm text-black/40">載入中...</p>
      ) : error ? (
        <p className="py-2 text-sm text-red-600">
          無法載入現有訂單：{error.message}
        </p>
      ) : orders.length === 0 ? (
        <p
          className={cn(
            'py-2 text-sm text-black/40',
            "font-['Noto_Sans_TC',sans-serif]",
          )}
        >
          尚未有訂單
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map(order => (
            <RoomOrderRow
              key={order.id}
              order={order}
              onSelect={() => onSelectOrder(order)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface RoomOrderRowProps {
  order: Order
  onSelect: () => void
}

function RoomOrderRow({ order, onSelect }: RoomOrderRowProps) {
  const status = normalizeOrderStatus(order.order_status)
  const pickupTime = formatCellDateTime(order.send_datetime)

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full flex-col gap-1 rounded-xl border border-transparent px-3 py-2.5 text-left transition',
          'hover:border-[#C5C7FF] hover:bg-[#F5F6FF] active:scale-[0.99]',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'w-10 flex-shrink-0 text-sm font-bold text-black/60',
              "font-['Noto_Sans_TC',sans-serif]",
            )}
          >
            #{order.id}
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm font-bold text-black',
              "font-['Noto_Sans_TC',sans-serif]",
            )}
            title={order.item}
          >
            {order.item}
          </span>
          <span
            className={cn(
              'inline-flex h-5 flex-shrink-0 items-center rounded-xl px-2 text-xs font-bold whitespace-nowrap',
              "font-['Noto_Sans_TC',sans-serif]",
              orderStatusBadgeClasses(status),
            )}
          >
            {orderStatusLabel(status)}
          </span>
        </div>
        {(pickupTime || order.total_amount != null) && (
          <div
            className={cn(
              'flex items-center gap-2 pl-10 text-xs text-black/50',
              "font-['Noto_Sans_TC',sans-serif]",
            )}
          >
            {pickupTime && <span>{pickupTime}</span>}
            {pickupTime && order.total_amount != null && (
              <span aria-hidden>·</span>
            )}
            {order.total_amount != null && (
              <span>NT {order.total_amount}</span>
            )}
          </div>
        )}
      </button>
    </li>
  )
}
