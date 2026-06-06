import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchChatRooms, switchChatRoomMode } from '@/api/messages'
import type { ChatRoom } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'
import { CHAT_ROOMS_QUERY_KEY } from '@/utils/chatRoomCache'

export { CHAT_ROOMS_QUERY_KEY }

export function useChatRooms() {
  return useQuery<ChatRoom[]>({
    queryKey: CHAT_ROOMS_QUERY_KEY,
    queryFn: fetchChatRooms,
    refetchOnWindowFocus: true,
  })
}

export function useSwitchChatRoomMode(roomId: number | null) {
  const qc = useQueryClient()

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
      if (roomId == null) return

      await qc.cancelQueries({ queryKey: CHAT_ROOMS_QUERY_KEY })

      const previousRooms = qc.getQueryData<ChatRoom[]>(CHAT_ROOMS_QUERY_KEY)
      qc.setQueryData<ChatRoom[]>(CHAT_ROOMS_QUERY_KEY, rooms =>
        patchRoomStage(rooms, stage) ?? [],
      )

      return { previousRooms }
    },
    onError: (_err, _stage, context) => {
      if (context?.previousRooms !== undefined) {
        qc.setQueryData(CHAT_ROOMS_QUERY_KEY, context.previousRooms)
      }
    },
    onSuccess: (_data, stage) => {
      qc.setQueryData<ChatRoom[]>(CHAT_ROOMS_QUERY_KEY, rooms =>
        patchRoomStage(rooms, stage) ?? [],
      )
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CHAT_ROOMS_QUERY_KEY })
    },
  })
}
