import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { fetchChatRoomsPage, markRoomRead, switchChatRoomMode } from '@/api/messages'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { chatRoomsQueryKey } from '@/lib/storeQueryKeys'
import type { ChatRoom, ChatRoomListParams, ChatRoomListResponse } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'

const ROOM_PAGE_SIZE = 30

/** @deprecated Use chatRoomsQueryKey(storeId) from storeQueryKeys. */
export const CHAT_ROOMS_QUERY_KEY = ['chatRooms'] as const

export interface ChatRoomsFilter {
  stage: ChatRoomStage | 'ALL'
  q: string
}

export function useChatRooms(filters: ChatRoomsFilter) {
  const { storeId, enabled } = useStoreQueryGate()
  const listParams: ChatRoomListParams = {
    limit: ROOM_PAGE_SIZE,
    stage: filters.stage,
    q: filters.q || undefined,
  }

  return useInfiniteQuery<ChatRoomListResponse>({
    queryKey:
      storeId != null
        ? chatRoomsQueryKey(storeId, listParams)
        : ['chatRooms', 'pending', listParams],
    queryFn: ({ pageParam = 0 }) =>
      fetchChatRoomsPage({
        ...listParams,
        offset: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined
      return allPages.reduce((sum, page) => sum + page.items.length, 0)
    },
    enabled,
    refetchOnWindowFocus: true,
  })
}

export function flattenChatRoomPages(
  data: { pages: ChatRoomListResponse[] } | undefined,
): ChatRoom[] {
  if (!data) return []
  return data.pages.flatMap(page => page.items)
}

export function getChatRoomsTotalUnread(
  data: { pages: ChatRoomListResponse[] } | undefined,
): number {
  return data?.pages[0]?.total_unread ?? 0
}

export function getChatRoomsFilteredUnreadRooms(
  data: { pages: ChatRoomListResponse[] } | undefined,
): number {
  return data?.pages[0]?.filtered_unread_rooms ?? 0
}

export function useSwitchChatRoomMode(roomId: number | null, filters: ChatRoomsFilter) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  const listParams: ChatRoomListParams = {
    limit: ROOM_PAGE_SIZE,
    stage: filters.stage,
    q: filters.q || undefined,
  }
  const listKey = storeId != null ? chatRoomsQueryKey(storeId, listParams) : null

  function patchRoomStage(pages: ChatRoomListResponse[] | undefined, stage: ChatRoomStage) {
    if (roomId == null || !pages) return pages
    return pages.map(page => ({
      ...page,
      items: page.items.map(room =>
        room.room_id === roomId ? { ...room, status: stage } : room,
      ),
    }))
  }

  return useMutation({
    mutationFn: (stage: ChatRoomStage) => {
      if (roomId == null) {
        return Promise.reject(new Error('No room selected'))
      }
      return switchChatRoomMode(roomId, stage)
    },
    onMutate: async stage => {
      if (roomId == null || listKey == null) return

      await qc.cancelQueries({ queryKey: listKey })

      const previous = qc.getQueryData<{ pages: ChatRoomListResponse[] }>(listKey)
      qc.setQueryData<{ pages: ChatRoomListResponse[]; pageParams: unknown[] }>(
        listKey,
        old => {
          if (!old) return old
          return {
            ...old,
            pages: patchRoomStage(old.pages, stage) ?? [],
          }
        },
      )

      return { previous }
    },
    onError: (_err, _stage, context) => {
      if (listKey != null && context?.previous !== undefined) {
        qc.setQueryData(listKey, context.previous)
      }
    },
    onSuccess: (_data, stage) => {
      if (listKey != null) {
        qc.setQueryData<{ pages: ChatRoomListResponse[]; pageParams: unknown[] }>(
          listKey,
          old => {
            if (!old) return old
            return {
              ...old,
              pages: patchRoomStage(old.pages, stage) ?? [],
            }
          },
        )
      }
    },
    onSettled: () => {
      if (listKey != null) {
        qc.invalidateQueries({ queryKey: listKey })
      }
    },
  })
}

export function useMarkRoomRead(filters: ChatRoomsFilter) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  const listParams: ChatRoomListParams = {
    limit: ROOM_PAGE_SIZE,
    stage: filters.stage,
    q: filters.q || undefined,
  }
  const listKey = storeId != null ? chatRoomsQueryKey(storeId, listParams) : null

  return useMutation({
    mutationFn: (roomId: number) => markRoomRead(roomId),
    onError: () => {
      if (listKey != null) {
        qc.invalidateQueries({ queryKey: listKey })
      }
    },
  })
}
