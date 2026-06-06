import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/api/messages'
import { useStoreQueryGate } from '@/hooks/useStoreQuery'
import { roomMessagesQueryKey } from '@/lib/storeQueryKeys'
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
        : ['roomMessages', 'pending'],
    queryFn: () => fetchRoomMessagesIncremental(qc, storeId as number, roomId as number),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
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

      await qc.cancelQueries({ queryKey: messagesKey })

      const previousMessages = qc.getQueryData<ChatMessage[]>(messagesKey)

      const optimistic = createOptimisticOutgoingMessage(body)
      qc.setQueryData<ChatMessage[]>(messagesKey, msgs => [...(msgs ?? []), optimistic])
      patchChatRoomLastMessage(qc, storeId, roomId, {
        text: previewTextFromMessage(optimistic),
        timestamp: optimistic.created_at,
      })

      return { previousMessages }
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

      if (context?.previousMessages !== undefined) {
        qc.setQueryData(messagesKey, context.previousMessages)
      }
      void qc.invalidateQueries({
        queryKey: ['chatRooms', storeId],
        predicate: query =>
          query.queryKey.length === 4 &&
          query.queryKey[0] === 'chatRooms' &&
          typeof query.queryKey[2] === 'string',
      })
    },
  })
}
