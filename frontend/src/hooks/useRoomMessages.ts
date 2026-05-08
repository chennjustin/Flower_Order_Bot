import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchRoomMessages, sendMessage } from '@/api/messages'
import type { ChatMessage, ChatMessageBody } from '@/types/domain'

export const roomMessagesQueryKey = (roomId: number) =>
  ['chatRooms', roomId, 'messages'] as const

export function useRoomMessages(roomId: number | null) {
  return useQuery<ChatMessage[]>({
    queryKey: roomId == null ? ['chatRooms', 'pending'] : roomMessagesQueryKey(roomId),
    queryFn: () => fetchRoomMessages(roomId as number),
    enabled: roomId != null,
    refetchInterval: roomId == null ? false : 10_000,
    refetchIntervalInBackground: false,
  })
}

export function useSendMessage(roomId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ChatMessageBody) => {
      if (roomId == null) {
        return Promise.reject(new Error('No room selected'))
      }
      return sendMessage(roomId, body)
    },
    onSuccess: () => {
      if (roomId != null) {
        qc.invalidateQueries({ queryKey: roomMessagesQueryKey(roomId) })
        qc.invalidateQueries({ queryKey: ['chatRooms'] })
      }
    },
  })
}
