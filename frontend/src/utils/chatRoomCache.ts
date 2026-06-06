import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { fetchRoomMessages } from '@/api/messages'
import { roomMessagesQueryKey } from '@/lib/storeQueryKeys'
import type { ChatMessage, ChatMessageBody, ChatRoom, ChatRoomListResponse } from '@/types/domain'
import { ChatMessageDirection, ChatMessageStatus } from '@/types/enums'

export { roomMessagesQueryKey } from '@/lib/storeQueryKeys'

type ChatRoomsInfinite = InfiniteData<ChatRoomListResponse>

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

function isStaffOutgoing(direction: ChatMessage['direction']): boolean {
  return (
    direction === ChatMessageDirection.OUTGOING_BY_STAFF ||
    direction === ChatMessageDirection.OUTGOING_BY_STORE
  )
}

function withoutOptimisticMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(m => m.id >= 0)
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

/** Room list infinite queries use string stage at index 2; message/draft keys use numeric room_id. */
function isChatRoomListQueryKey(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[2] === 'string'
}

function patchInfiniteChatRooms(
  data: ChatRoomsInfinite | undefined,
  roomId: number,
  patch: { text: string; timestamp: string },
  options?: { bumpUnread?: boolean; selectedRoomId?: number | null },
): ChatRoomsInfinite | undefined {
  if (!data?.pages) return data
  return {
    ...data,
    pages: data.pages.map((page, pageIndex) => ({
      ...page,
      items: sortChatRoomsByLastMessage(
        page.items.map(room => {
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
        }),
      ),
      total_unread:
        pageIndex === 0 && options?.bumpUnread && options.selectedRoomId !== roomId
          ? page.total_unread + 1
          : page.total_unread,
    })),
  }
}

export function patchChatRoomLastMessage(
  qc: QueryClient,
  storeId: number,
  roomId: number,
  patch: { text: string; timestamp: string },
  options?: { bumpUnread?: boolean; selectedRoomId?: number | null },
): void {
  qc.setQueriesData<ChatRoomsInfinite>(
    {
      queryKey: ['chatRooms', storeId],
      predicate: query => isChatRoomListQueryKey(query.queryKey),
    },
    data => patchInfiniteChatRooms(data, roomId, patch, options),
  )
}

export function mergeRoomMessages(
  cached: ChatMessage[] | undefined,
  delta: ChatMessage[],
): ChatMessage[] {
  const hasConfirmedStaffOutgoing = delta.some(
    m => m.id > 0 && isStaffOutgoing(m.direction),
  )
  const base = hasConfirmedStaffOutgoing
    ? withoutOptimisticMessages(cached ?? [])
    : (cached ?? [])

  const map = new Map<number, ChatMessage>()
  for (const m of base) {
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
  return mergeRoomMessages(withoutOptimisticMessages(messages), [sent])
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
  options?: { updateMessages?: boolean },
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

  if (options?.updateMessages === false) return

  const key = roomMessagesQueryKey(storeId, roomId)
  const hasCache =
    qc.getQueryData<ChatMessage[]>(key) !== undefined || roomId === selectedRoomId
  if (!hasCache) return

  qc.setQueryData<ChatMessage[]>(key, msgs => {
    const base = msgs ?? []
    if (message.id > 0 && base.some(m => m.id === message.id)) {
      return isStaffOutgoing(message.direction)
        ? withoutOptimisticMessages(base)
        : base
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
