import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { fetchRoomMessages } from '@/api/messages'
import { roomMessagesQueryKey } from '@/lib/storeQueryKeys'
import type { ChatMessage, ChatMessageBody, ChatRoom, ChatRoomListResponse } from '@/types/domain'
import { ChatMessageDirection, ChatMessageStatus, type ChatRoomStage } from '@/types/enums'

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

/** Infinite list keys: ['chatRooms', storeId, stage, q] */
function isChatRoomListQueryKey(queryKey: readonly unknown[]): boolean {
  return (
    queryKey.length === 4 &&
    queryKey[0] === 'chatRooms' &&
    typeof queryKey[2] === 'string' &&
    typeof queryKey[3] === 'string'
  )
}

function bubbleRoomInInfinitePages(
  data: ChatRoomsInfinite | undefined,
  roomId: number,
  updater: (room: ChatRoom) => ChatRoom,
  options?: { bumpUnread?: boolean; selectedRoomId?: number | null },
): { data: ChatRoomsInfinite; found: boolean } {
  if (!data?.pages) {
    return { data: data as ChatRoomsInfinite, found: false }
  }

  const shouldBumpUnread =
    options?.bumpUnread === true && roomId !== options.selectedRoomId

  let previousUnreadCount = 0
  let patchedRoom: ChatRoom | undefined
  for (const page of data.pages) {
    const hit = (page.items ?? []).find(r => r.room_id === roomId)
    if (hit) {
      previousUnreadCount = hit.unread_count
      patchedRoom = updater(hit)
      break
    }
  }

  if (!patchedRoom) {
    return { data, found: false }
  }

  const pages = data.pages.map(page => ({
    ...page,
    items: (page.items ?? []).filter(room => room.room_id !== roomId),
  }))

  const bumpedUnreadRooms =
    shouldBumpUnread && previousUnreadCount === 0 && patchedRoom.unread_count > 0 ? 1 : 0

  if (pages[0]) {
    pages[0] = {
      ...pages[0],
      items: sortChatRoomsByLastMessage([patchedRoom, ...(pages[0].items ?? [])]),
      total_unread: shouldBumpUnread ? pages[0].total_unread + 1 : pages[0].total_unread,
      filtered_unread_rooms: pages[0].filtered_unread_rooms + bumpedUnreadRooms,
    }
  }

  return { data: { ...data, pages }, found: true }
}

export function patchChatRoomLastMessage(
  qc: QueryClient,
  storeId: number,
  roomId: number,
  patch: { text: string; timestamp: string },
  options?: { bumpUnread?: boolean; selectedRoomId?: number | null },
): void {
  let anyFound = false

  qc.setQueriesData<ChatRoomsInfinite>(
    {
      queryKey: ['chatRooms', storeId],
      predicate: query => isChatRoomListQueryKey(query.queryKey),
    },
    data => {
      const { data: next, found } = bubbleRoomInInfinitePages(
        data,
        roomId,
        room => {
          const bumpUnread =
            options?.bumpUnread === true && roomId !== options.selectedRoomId
          return {
            ...room,
            unread_count: bumpUnread ? room.unread_count + 1 : room.unread_count,
            last_message: { text: patch.text, timestamp: patch.timestamp },
          }
        },
        options,
      )
      if (found) anyFound = true
      return next
    },
  )

  if (!anyFound) {
    void qc.invalidateQueries({ queryKey: ['chatRooms', storeId] })
  }
}

export function clearRoomUnread(
  qc: QueryClient,
  storeId: number,
  roomId: number,
): void {
  qc.setQueriesData<ChatRoomsInfinite>(
    {
      queryKey: ['chatRooms', storeId],
      predicate: query => isChatRoomListQueryKey(query.queryKey),
    },
    data => {
      if (!data?.pages) return data
      return {
        ...data,
        pages: data.pages.map((page, pageIndex) => {
          let clearedUnread = 0
          let decrementedUnreadRooms = 0
          const nextItems = page.items.map(room => {
            if (room.room_id !== roomId) return room
            const previousUnread = room.unread_count
            if (previousUnread > 0) {
              clearedUnread += previousUnread
              decrementedUnreadRooms += 1
            }
            return { ...room, unread_count: 0 }
          })
          return {
            ...page,
            items: nextItems,
            total_unread:
              pageIndex === 0
                ? Math.max(0, page.total_unread - clearedUnread)
                : page.total_unread,
            filtered_unread_rooms:
              pageIndex === 0
                ? Math.max(0, page.filtered_unread_rooms - decrementedUnreadRooms)
                : page.filtered_unread_rooms,
          }
        }),
      }
    },
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
    qc.setQueryData<ChatMessage[]>(key, current => mergeRoomMessages(current, full))
    return qc.getQueryData<ChatMessage[]>(key) ?? full
  }

  const realMessages = cached.filter(m => m.id > 0)
  const last = realMessages[realMessages.length - 1]
  const delta = await fetchRoomMessages(roomId, last?.created_at)
  if (delta.length === 0) {
    return qc.getQueryData<ChatMessage[]>(key) ?? cached
  }

  qc.setQueryData<ChatMessage[]>(key, current => mergeRoomMessages(current, delta))
  const merged = qc.getQueryData<ChatMessage[]>(key) ?? mergeRoomMessages(cached, delta)

  const lastMsg = delta[delta.length - 1]
  patchChatRoomLastMessage(qc, storeId, roomId, {
    text: previewTextFromMessage(lastMsg),
    timestamp: lastMsg.created_at,
  })
  return merged
}

export function applyStreamStageToCache(
  qc: QueryClient,
  storeId: number,
  roomId: number,
  stage: ChatRoomStage,
): void {
  qc.setQueriesData<ChatRoomsInfinite>(
    {
      queryKey: ['chatRooms', storeId],
      predicate: query => isChatRoomListQueryKey(query.queryKey),
    },
    data => {
      if (!data?.pages) return data
      return {
        ...data,
        pages: data.pages.map(page => ({
          ...page,
          items: (page.items ?? []).map(room =>
            room.room_id === roomId ? { ...room, status: stage } : room,
          ),
        })),
      }
    },
  )
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
  const shouldUpdateMessages =
    qc.getQueryData<ChatMessage[]>(key) !== undefined || roomId === selectedRoomId
  if (!shouldUpdateMessages) return

  void qc.cancelQueries({ queryKey: key })

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
