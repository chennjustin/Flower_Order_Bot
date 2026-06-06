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

export function useChatRealtime(
  storeId: number | null,
  selectedRoomId: number | null,
) {
  const qc = useQueryClient()
  const [sseAvailable, setSseAvailable] = useState(true)
  const selectedRef = useRef(selectedRoomId)
  const storeRef = useRef(storeId)
  selectedRef.current = selectedRoomId
  storeRef.current = storeId

  useEffect(() => {
    if (storeId == null) return

    const es = new EventSource(`${API_BASE}/chat_rooms/stream`)

    es.addEventListener('error', () => {
      setSseAvailable(false)
    })

    es.onmessage = ev => {
      const payload = parseStreamPayload(ev.data)
      const activeStoreId = storeRef.current
      if (!payload || activeStoreId == null) return
      applyStreamMessageToCache(
        qc,
        activeStoreId,
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
  }, [qc, storeId])

  useEffect(() => {
    if (selectedRoomId == null || storeId == null) return

    const es = new EventSource(`${API_BASE}/chat_rooms/${selectedRoomId}/stream`)

    es.addEventListener('error', () => {
      setSseAvailable(false)
    })

    es.onmessage = ev => {
      const payload = parseStreamPayload(ev.data)
      const activeStoreId = storeRef.current
      if (!payload || activeStoreId == null) return
      applyStreamMessageToCache(
        qc,
        activeStoreId,
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
  }, [qc, storeId, selectedRoomId])

  return { sseAvailable }
}
