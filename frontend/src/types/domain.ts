/**
 * Domain types mirroring [`backend/app/schemas/`](../../../backend/app/schemas/).
 * Datetime fields arrive as ISO 8601 strings over JSON.
 */

import type {
  ChatMessageDirection,
  ChatMessageStatus,
  ChatRoomStage,
  OrderStatus,
  ShipmentMethod,
} from './enums'

export interface OrderDraftBase {
  customer_name?: string | null
  customer_phone?: string | null
  receiver_name?: string | null
  receiver_phone?: string | null
  total_amount?: number | null
  item?: string | null
  quantity?: number | null
  note?: string | null
  card_message?: string | null
  shipment_method?: ShipmentMethod | null
  send_datetime?: string | null
  receipt_address?: string | null
  delivery_address?: string | null
}

export interface OrderDraftUpdate extends OrderDraftBase {
  pay_way_id?: number | null
  pay_way?: string | null
}

export interface OrderDraft extends OrderDraftBase {
  id: number
  order_date: string
  pay_way?: string | null
  weekday?: string | null
}

export interface OrderBase {
  customer_name: string
  customer_phone: string
  receiver_name?: string | null
  receiver_phone?: string | null
  total_amount: number
  item: string
  quantity: number
  note?: string | null
  card_message?: string | null
  shipment_method: ShipmentMethod
  send_datetime: string
  receipt_address?: string | null
  delivery_address?: string | null
}

export interface Order extends OrderBase {
  id: number
  order_date: string
  order_status: OrderStatus
  pay_way?: string | null
  weekday?: string | null
}

export interface LastMessage {
  text: string
  timestamp: string
}

export interface ChatRoom {
  room_id: number
  user_name: string
  user_avatar_url?: string | null
  unread_count: number
  status: ChatRoomStage
  last_message?: LastMessage | null
}

export interface ChatMessageBody {
  text?: string | null
  image_url?: string | null
  sticker_package_id?: string | null
  sticker_id?: string | null
}

export interface ChatMessage {
  id: number
  user_avatar_url?: string | null
  direction: ChatMessageDirection
  message: ChatMessageBody
  status: ChatMessageStatus
  created_at: string
}

export interface Stats {
  today_orders: number
  pending_orders: number
  monthly_income: number
  total_customers: number
}

/**
 * Result wrapper for `POST /order/{room_id}`.
 * Backend returns `[]` on success and `string[]` of missing field keys when
 * the draft is incomplete; we normalize to a discriminated-friendly shape.
 */
export interface CreateOrderResult {
  ok: boolean
  missing: string[]
}
