/** Order row used in dashboards / orders table (backend shape may vary slightly). */
export interface OrderRecord {
  id: number | string
  customer_name?: string
  customer_phone?: string
  receipt_address?: string
  order_date?: string | null
  total_amount?: number | string | null
  item?: string
  quantity?: number | string | null
  note?: string
  pay_way?: string
  card_message?: string
  weekday?: string
  send_datetime?: string | null
  receiver_name?: string
  receiver_phone?: string
  delivery_address?: string
  /** Raw status from backend (conversation or lifecycle codes). */
  order_status?: string
  shipment_method?: string
  pay_status?: string
}

/** Statistics payload returned by GET /stats */
export interface StaticStats {
  today_orders?: number
  pending_orders?: number
  monthly_income?: number
  total_customers?: number
}

/** Chat room list item mapped for UI lists */
export interface ChatRoomUi {
  id: string
  name: string
  lastMessage: string
  lastMessageTime: Date | null
  unreadCount: number
  /** Backend status enum string */
  status: string
  avatar: string
}

/** Message bubble after mapping API response */
export interface ChatMessageUi {
  id: string | number
  avatar?: string
  sender: string
  text: string
  timestamp: Date
  direction: string
}

export interface OrderDraftPayload {
  customer_name?: string
  customer_phone?: string
  receiver_name?: string
  receiver_phone?: string
  total_amount?: number
  item?: string
  quantity?: number
  note?: string
  card_message?: string
  shipment_method?: string
  send_datetime?: string
  receipt_address?: string
  delivery_address?: string
  pay_way?: string
  pay_way_id?: number
}
