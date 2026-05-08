import { api } from './client'
import type { ChatMessage, ChatMessageBody, ChatRoom } from '@/types/domain'

export async function fetchChatRooms(): Promise<ChatRoom[]> {
  const { data } = await api.get<ChatRoom[]>('/chat_rooms')
  return data
}

export async function fetchRoomMessages(
  roomId: number,
  after?: string,
): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(
    `/chat_rooms/${roomId}/messages`,
    { params: after ? { after } : undefined },
  )
  return data
}

export async function sendMessage(
  roomId: number,
  body: ChatMessageBody,
): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(
    `/chat_rooms/${roomId}/messages`,
    body,
  )
  return data
}
