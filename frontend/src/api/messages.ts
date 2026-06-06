import { api } from './client'
import type {
  ChatMessage,
  ChatMessageBody,
  ChatRoomListParams,
  ChatRoomListResponse,
} from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'

const DEFAULT_ROOM_PAGE_SIZE = 30

function buildChatRoomQueryParams(
  params: ChatRoomListParams,
): Record<string, string | number> {
  const query: Record<string, string | number> = {
    limit: params.limit ?? DEFAULT_ROOM_PAGE_SIZE,
    offset: params.offset ?? 0,
  }
  if (params.stage && params.stage !== 'ALL') {
    query.stage = params.stage
  }
  if (params.q) query.q = params.q
  return query
}

export async function fetchChatRoomsPage(
  params: ChatRoomListParams = {},
): Promise<ChatRoomListResponse> {
  const { data } = await api.get<ChatRoomListResponse>('/chat_rooms', {
    params: buildChatRoomQueryParams(params),
  })
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

/** Switch a chat room stage (store staff manual override). */
export async function switchChatRoomMode(
  roomId: number,
  stage: ChatRoomStage,
): Promise<void> {
  await api.post(`/chat_rooms/${roomId}/switch_mode`, { stage })
}

export async function uploadStaffChatImage(
  roomId: number,
  file: File,
): Promise<{ image_url: string }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ image_url: string }>(
    `/chat_rooms/${roomId}/messages/upload_image`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}
