import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/api/messages'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { chatRoomsQueryKey, roomMessagesQueryKey } from '@/lib/storeQueryKeys'
import type { ChatMessage, ChatMessageBody } from '@/types/domain'
import {
  createOptimisticOutgoingMessage,
  fetchRoomMessagesIncremental,
  patchChatRoomLastMessage,
  prefetchRoomMessages,
  previewTextFromMessage,
  replaceOptimisticMessage,
} from '@/utils/chatRoomCache'

export { roomMessagesQueryKey, prefetchRoomMessages }

export function useRoomMessages(roomId: number | null) {
  const qc = useQueryClient()
  const { storeId, enabled: storeReady } = useStoreQueryGate()
  const enabled = storeReady && roomId != null && storeId != null

  return useQuery<ChatMessage[]>({
    queryKey:
      storeId != null && roomId != null
        ? roomMessagesQueryKey(storeId, roomId)
        : ['chatRooms', 'pending', 'messages'],
    queryFn: () => fetchRoomMessagesIncremental(qc, storeId as number, roomId as number),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
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
    onMutate: async body => {
      if (roomId == null || storeId == null) return

      const messagesKey = roomMessagesQueryKey(storeId, roomId)
      const roomsKey = chatRoomsQueryKey(storeId)

      await qc.cancelQueries({ queryKey: messagesKey })
      await qc.cancelQueries({ queryKey: roomsKey })

      const previousMessages = qc.getQueryData<ChatMessage[]>(messagesKey)
      const previousRooms = qc.getQueryData(roomsKey)

      const optimistic = createOptimisticOutgoingMessage(body)
      qc.setQueryData<ChatMessage[]>(messagesKey, msgs => [...(msgs ?? []), optimistic])
      patchChatRoomLastMessage(qc, storeId, roomId, {
        text: previewTextFromMessage(optimistic),
        timestamp: optimistic.created_at,
      })

      return { previousMessages, previousRooms }
    },
    onSuccess: (sent, _body, context) => {
      if (roomId == null || storeId == null) return

      const messagesKey = roomMessagesQueryKey(storeId, roomId)
      qc.setQueryData<ChatMessage[]>(messagesKey, msgs =>
        replaceOptimisticMessage(msgs ?? context?.previousMessages ?? [], sent),
      )
      patchChatRoomLastMessage(qc, storeId, roomId, {
        text: previewTextFromMessage(sent),
        timestamp: sent.created_at,
      })
    },
    onError: (_err, _body, context) => {
      if (roomId == null || storeId == null) return

      const messagesKey = roomMessagesQueryKey(storeId, roomId)
      const roomsKey = chatRoomsQueryKey(storeId)

      if (context?.previousMessages !== undefined) {
        qc.setQueryData(messagesKey, context.previousMessages)
      }
      if (context?.previousRooms !== undefined) {
        qc.setQueryData(roomsKey, context.previousRooms)
      }
    },
  })
}
