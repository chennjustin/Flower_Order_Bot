import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchChatRooms, switchChatRoomMode } from '@/api/messages'
import type { ChatRoom } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'

export const CHAT_ROOMS_QUERY_KEY = ['chatRooms'] as const

export function useChatRooms() {
  return useQuery<ChatRoom[]>({
    queryKey: CHAT_ROOMS_QUERY_KEY,
    queryFn: fetchChatRooms,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}

export function useSwitchChatRoomMode(roomId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stage: ChatRoomStage) => {
      if (roomId == null) {
        return Promise.reject(new Error('No room selected'))
      }
      return switchChatRoomMode(roomId, stage)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAT_ROOMS_QUERY_KEY })
    },
  })
}
