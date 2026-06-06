import type { QueryClient } from '@tanstack/react-query'

import { fetchRoomMessages } from '@/api/messages'
import { chatRoomsQueryKey, roomMessagesQueryKey } from '@/lib/storeQueryKeys'
import type { ChatMessage, ChatMessageBody, ChatRoom } from '@/types/domain'
import { ChatMessageDirection, ChatMessageStatus } from '@/types/enums'

export { roomMessagesQueryKey } from '@/lib/storeQueryKeys'

export function previewTextFromBody(body: ChatMessageBody): string {
  const text = (body.text ?? '').trim()
  if (text) return text
  if ((body.image_url ?? '').trim()) return '[圖片]'
  if ((body.sticker_package_id ?? '').trim() && (body.sticker_id ?? '').trim()) {
    return '[貼圖]'
  }
  return ''
}

export function previewTextFromMessage(msg: ChatMessage): string {
  return previewTextFromBody(msg.message)
}

export function sortChatRoomsByLastMessage(rooms: ChatRoom[]): ChatRoom[] {
  return [...rooms].sort((a, b) => {
    const ta = a.last_message?.timestamp
      ? new Date(a.last_message.timestamp).getTime()
      : 0
    const tb = b.last_message?.timestamp
      ? new Date(b.last_message.timestamp).getTime()
      : 0
    return tb - ta
  })
}

export function patchChatRoomLastMessage(
  qc: QueryClient,
  storeId: number,
  roomId: number,
  patch: { text: string; timestamp: string },
  options?: { bumpUnread?: boolean; selectedRoomId?: number | null },
): void {
  qc.setQueryData<ChatRoom[]>(chatRoomsQueryKey(storeId), rooms => {
    if (!rooms) return rooms
    const updated = rooms.map(room => {
      if (room.room_id !== roomId) return room
      const bumpUnread =
        options?.bumpUnread === true &&
        options.selectedRoomId != null &&
        roomId !== options.selectedRoomId
      return {
        ...room,
        unread_count: bumpUnread ? room.unread_count + 1 : room.unread_count,
        last_message: { text: patch.text, timestamp: patch.timestamp },
      }
    })
    return sortChatRoomsByLastMessage(updated)
  })
}

export function mergeRoomMessages(
  cached: ChatMessage[] | undefined,
  delta: ChatMessage[],
): ChatMessage[] {
  const map = new Map<number, ChatMessage>()
  for (const m of cached ?? []) {
    map.set(m.id, m)
  }
  for (const m of delta) {
    map.set(m.id, m)
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

export function replaceOptimisticMessage(
  messages: ChatMessage[],
  sent: ChatMessage,
): ChatMessage[] {
  const withoutOptimistic = messages.filter(m => m.id >= 0)
  return mergeRoomMessages(withoutOptimistic, [sent])
}

export function createOptimisticOutgoingMessage(body: ChatMessageBody): ChatMessage {
  return {
    id: -Date.now(),
    direction: ChatMessageDirection.OUTGOING_BY_STAFF,
    message: body,
    status: ChatMessageStatus.PENDING,
    created_at: new Date().toISOString(),
  }
}

export async function fetchRoomMessagesIncremental(
  qc: QueryClient,
  storeId: number,
  roomId: number,
): Promise<ChatMessage[]> {
  const key = roomMessagesQueryKey(storeId, roomId)
  const cached = qc.getQueryData<ChatMessage[]>(key)
  if (!cached || cached.length === 0) {
    const full = await fetchRoomMessages(roomId)
    qc.setQueryData(key, full)
    return full
  }

  const realMessages = cached.filter(m => m.id > 0)
  const last = realMessages[realMessages.length - 1]
  const delta = await fetchRoomMessages(roomId, last?.created_at)
  if (delta.length === 0) return cached

  const merged = mergeRoomMessages(cached, delta)
  qc.setQueryData(key, merged)

  const lastMsg = delta[delta.length - 1]
  patchChatRoomLastMessage(qc, storeId, roomId, {
    text: previewTextFromMessage(lastMsg),
    timestamp: lastMsg.created_at,
  })
  return merged
}

export function applyStreamMessageToCache(
  qc: QueryClient,
  storeId: number,
  roomId: number,
  message: ChatMessage,
  selectedRoomId: number | null,
): void {
  patchChatRoomLastMessage(
    qc,
    storeId,
    roomId,
    {
      text: previewTextFromMessage(message),
      timestamp: message.created_at,
    },
    {
      bumpUnread: message.direction === ChatMessageDirection.INCOMING,
      selectedRoomId,
    },
  )

  const key = roomMessagesQueryKey(storeId, roomId)
  const hasCache =
    qc.getQueryData<ChatMessage[]>(key) !== undefined || roomId === selectedRoomId
  if (!hasCache) return

  qc.setQueryData<ChatMessage[]>(key, msgs => {
    let base = msgs ?? []
    if (message.direction === ChatMessageDirection.OUTGOING_BY_STAFF) {
      base = base.filter(m => m.id >= 0)
    }
    return mergeRoomMessages(base, [message])
  })
}

export function prefetchRoomMessages(
  qc: QueryClient,
  storeId: number,
  roomId: number,
): void {
  void qc.prefetchQuery({
    queryKey: roomMessagesQueryKey(storeId, roomId),
    queryFn: () => fetchRoomMessagesIncremental(qc, storeId, roomId),
    staleTime: 5 * 60_000,
  })
}
