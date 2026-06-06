import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { API_BASE } from '@/api/client'
import type { ChatMessage } from '@/types/domain'
import { applyStreamMessageToCache } from '@/utils/chatRoomCache'

interface ChatStreamEvent {
  type: 'message'
  room_id: number
  message: ChatMessage
}

function parseStreamPayload(data: string): ChatStreamEvent | null {
  if (!data || data.startsWith(':')) return null
  try {
    const payload = JSON.parse(data) as ChatStreamEvent
    if (payload.type !== 'message' || payload.message == null) return null
    return payload
  } catch {
    return null
  }
}

export function useChatRealtime(selectedRoomId: number | null) {
  const qc = useQueryClient()
  const [sseAvailable, setSseAvailable] = useState(true)
  const selectedRef = useRef(selectedRoomId)
  selectedRef.current = selectedRoomId

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/chat_rooms/stream`)

    es.addEventListener('error', () => {
      setSseAvailable(false)
    })

    es.onmessage = ev => {
      const payload = parseStreamPayload(ev.data)
      if (!payload) return
      applyStreamMessageToCache(
        qc,
        payload.room_id,
        payload.message,
        selectedRef.current,
      )
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setSseAvailable(false)
      }
    }

    return () => es.close()
  }, [qc])

  useEffect(() => {
    if (selectedRoomId == null) return

    const es = new EventSource(`${API_BASE}/chat_rooms/${selectedRoomId}/stream`)

    es.addEventListener('error', () => {
      setSseAvailable(false)
    })

    es.onmessage = ev => {
      const payload = parseStreamPayload(ev.data)
      if (!payload) return
      applyStreamMessageToCache(
        qc,
        selectedRoomId,
        payload.message,
        selectedRef.current,
      )
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setSseAvailable(false)
      }
    }

    return () => es.close()
  }, [qc, selectedRoomId])

  return { sseAvailable }
}
