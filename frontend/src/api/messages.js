import { api } from './client'

export const getLatestMessages = async () => {
    const res = await api.get(`/chat_rooms`)
    return res.data.map(room => ({
        id: room.room_id,
        name: room.user_name,
        lastMessage: room.last_message ? room.last_message.text : '',
        lastMessageTime: room.last_message ? new Date(room.last_message.timestamp) : null,
        unreadCount: room.unread_count,
        status: room.status,
        avatar: room.user_avatar_url || '' // Map user_avatar_url to avatar field
    }))
}

export const getRoomMessages = async (roomId) => {
    const res = await api.get(`/chat_rooms/${roomId}/messages`)
    return res.data
}

export const sendMessage = async (roomId, message) => {
    const res = await api.post(`/chat_rooms/${roomId}/messages`, message)
    return res.data
}