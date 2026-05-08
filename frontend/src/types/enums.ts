/**
 * Mirror of [`backend/app/enums/`](../../../backend/app/enums/).
 * Keep values in sync if the backend enums change.
 */

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const ShipmentMethod = {
  STORE_PICKUP: 'STORE_PICKUP',
  DELIVERY: 'DELIVERY',
} as const
export type ShipmentMethod = (typeof ShipmentMethod)[keyof typeof ShipmentMethod]

export const ShipmentStatus = {
  PENDING: 'PENDING',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
} as const
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus]

export const PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const ChatRoomStage = {
  WELCOME: 'WELCOME',
  IDLE: 'IDLE',
  ORDER_CONFIRM: 'ORDER_CONFIRM',
  WAITING_OWNER: 'WAITING_OWNER',
  BOT_ACTIVE: 'BOT_ACTIVE',
} as const
export type ChatRoomStage = (typeof ChatRoomStage)[keyof typeof ChatRoomStage]

export const ChatMessageStatus = {
  SENT: 'SENT',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
} as const
export type ChatMessageStatus =
  (typeof ChatMessageStatus)[keyof typeof ChatMessageStatus]

export const ChatMessageDirection = {
  INCOMING: 'INCOMING',
  OUTGOING_BY_BOT: 'OUTGOING_BY_BOT',
  OUTGOING_BY_STAFF: 'OUTGOING_BY_STAFF',
} as const
export type ChatMessageDirection =
  (typeof ChatMessageDirection)[keyof typeof ChatMessageDirection]
