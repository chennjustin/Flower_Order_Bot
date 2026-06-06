import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchChatRooms, switchChatRoomMode } from '@/api/messages'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { chatRoomsQueryKey } from '@/lib/storeQueryKeys'
import type { ChatRoom } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'

/** @deprecated Use chatRoomsQueryKey(storeId) from storeQueryKeys. */
export const CHAT_ROOMS_QUERY_KEY = ['chatRooms'] as const

export function useChatRooms() {
  const { storeId, enabled } = useStoreQueryGate()
  return useQuery<ChatRoom[]>({
    queryKey: storeId != null ? chatRoomsQueryKey(storeId) : ['chatRooms', 'pending'],
    queryFn: fetchChatRooms,
    enabled,
    refetchInterval: enabled ? 5000 : false,
    refetchIntervalInBackground: false,
  })
}

export function useSwitchChatRoomMode(roomId: number | null) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  const listKey = storeId != null ? chatRoomsQueryKey(storeId) : null

  /** Patch one room's stage inside the shared chatRooms cache. */
  function patchRoomStage(rooms: ChatRoom[] | undefined, stage: ChatRoomStage) {
    if (roomId == null || !rooms) return rooms
    return rooms.map(room =>
      room.room_id === roomId ? { ...room, status: stage } : room,
    )
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

      const previousRooms = qc.getQueryData<ChatRoom[]>(listKey)
      qc.setQueryData<ChatRoom[]>(listKey, rooms => patchRoomStage(rooms, stage) ?? [])

      return { previousRooms }
    },
    onError: (_err, _stage, context) => {
      if (listKey != null && context?.previousRooms !== undefined) {
        qc.setQueryData(listKey, context.previousRooms)
      }
    },
    onSuccess: (_data, stage) => {
      if (listKey != null) {
        qc.setQueryData<ChatRoom[]>(listKey, rooms => patchRoomStage(rooms, stage) ?? [])
      }
    },
    onSettled: () => {
      if (listKey != null) {
        qc.invalidateQueries({ queryKey: listKey })
      }
    },
  })
}
