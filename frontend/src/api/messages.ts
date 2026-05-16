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

export async function uploadStaffChatImage(
  roomId: number,
  file: File,
): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<{ image_url: string }>(
    `/chat_rooms/${roomId}/messages/upload_image`,
    fd,
  )
  return data.image_url
}
