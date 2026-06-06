import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchRoomMessages, sendMessage } from '@/api/messages'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { chatRoomsQueryKey, roomMessagesQueryKey } from '@/lib/storeQueryKeys'
import type { ChatMessage, ChatMessageBody } from '@/types/domain'

export function useRoomMessages(roomId: number | null) {
  const { storeId, enabled: storeReady } = useStoreQueryGate()
  const enabled = storeReady && roomId != null && storeId != null

  return useQuery<ChatMessage[]>({
    queryKey:
      storeId != null && roomId != null
        ? roomMessagesQueryKey(storeId, roomId)
        : ['chatRooms', 'pending', 'messages'],
    queryFn: () => fetchRoomMessages(roomId as number),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
  })
}

export function useSendMessage(roomId: number | null) {
  const qc = useQueryClient()
  const { storeId } = useStoreQueryGate()
  return useMutation({
    mutationFn: (body: ChatMessageBody) => {
      if (roomId == null) {
        return Promise.reject(new Error('No room selected'))
      }
      return sendMessage(roomId, body)
    },
    onSuccess: () => {
      if (roomId != null && storeId != null) {
        qc.invalidateQueries({ queryKey: roomMessagesQueryKey(storeId, roomId) })
        qc.invalidateQueries({ queryKey: chatRoomsQueryKey(storeId) })
      }
    },
  })
}
