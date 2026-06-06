import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/api/messages'
import type { ChatMessage, ChatMessageBody } from '@/types/domain'
import {
  CHAT_ROOMS_QUERY_KEY,
  createOptimisticOutgoingMessage,
  fetchRoomMessagesIncremental,
  patchChatRoomLastMessage,
  prefetchRoomMessages,
  previewTextFromMessage,
  replaceOptimisticMessage,
  roomMessagesQueryKey,
} from '@/utils/chatRoomCache'

export { roomMessagesQueryKey, prefetchRoomMessages }

export function useRoomMessages(roomId: number | null) {
  const qc = useQueryClient()

  return useQuery<ChatMessage[]>({
    queryKey: roomId == null ? ['chatRooms', 'pending'] : roomMessagesQueryKey(roomId),
    queryFn: () => fetchRoomMessagesIncremental(qc, roomId as number),
    enabled: roomId != null,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
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
    onMutate: async body => {
      if (roomId == null) return

      await qc.cancelQueries({ queryKey: roomMessagesQueryKey(roomId) })
      await qc.cancelQueries({ queryKey: CHAT_ROOMS_QUERY_KEY })

      const previousMessages = qc.getQueryData<ChatMessage[]>(
        roomMessagesQueryKey(roomId),
      )
      const previousRooms = qc.getQueryData(CHAT_ROOMS_QUERY_KEY)

      const optimistic = createOptimisticOutgoingMessage(body)
      qc.setQueryData<ChatMessage[]>(roomMessagesQueryKey(roomId), msgs =>
        [...(msgs ?? []), optimistic],
      )
      patchChatRoomLastMessage(qc, roomId, {
        text: previewTextFromMessage(optimistic),
        timestamp: optimistic.created_at,
      })

      return { previousMessages, previousRooms }
    },
    onSuccess: (sent, _body, context) => {
      if (roomId == null) return

      qc.setQueryData<ChatMessage[]>(roomMessagesQueryKey(roomId), msgs =>
        replaceOptimisticMessage(msgs ?? context?.previousMessages ?? [], sent),
      )
      patchChatRoomLastMessage(qc, roomId, {
        text: previewTextFromMessage(sent),
        timestamp: sent.created_at,
      })
    },
    onError: (_err, _body, context) => {
      if (roomId == null) return

      if (context?.previousMessages !== undefined) {
        qc.setQueryData(roomMessagesQueryKey(roomId), context.previousMessages)
      }
      if (context?.previousRooms !== undefined) {
        qc.setQueryData(CHAT_ROOMS_QUERY_KEY, context.previousRooms)
      }
    },
  })
}
