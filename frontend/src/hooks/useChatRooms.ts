import { useQuery } from '@tanstack/react-query'
import { fetchChatRooms } from '@/api/messages'
import type { ChatRoom } from '@/types/domain'

export const CHAT_ROOMS_QUERY_KEY = ['chatRooms'] as const

export function useChatRooms() {
  return useQuery<ChatRoom[]>({
    queryKey: CHAT_ROOMS_QUERY_KEY,
    queryFn: fetchChatRooms,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}
