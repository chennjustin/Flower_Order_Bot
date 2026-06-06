import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { API_BASE } from '@/api/client'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types/domain'
import type { ChatRoomStage } from '@/types/enums'
import {
  applyStreamMessageToCache,
  applyStreamStageToCache,
} from '@/utils/chatRoomCache'

interface ChatMessageStreamEvent {
  type: 'message'
  room_id: number
  store_id?: number
  message: ChatMessage
}

interface ChatStageStreamEvent {
  type: 'stage'
  room_id: number
  store_id?: number
  stage: ChatRoomStage
}

type ChatStreamEvent = ChatMessageStreamEvent | ChatStageStreamEvent

function parseStreamPayload(data: string): ChatStreamEvent | null {
  if (!data || data.startsWith(':')) return null
  try {
    const payload = JSON.parse(data) as ChatStreamEvent
    if (payload.type === 'message' && payload.message != null) return payload
    if (payload.type === 'stage' && payload.stage != null) return payload
    return null
  } catch {
    return null
  }
}

async function buildSseUrl(path: string): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)
  return url.toString()
}

function applyStreamEvent(
  qc: ReturnType<typeof useQueryClient>,
  storeId: number,
  payload: ChatStreamEvent,
  selectedRoomId: number | null,
): void {
  if (payload.type === 'stage') {
    applyStreamStageToCache(qc, storeId, payload.room_id, payload.stage)
    return
  }

  applyStreamMessageToCache(
    qc,
    storeId,
    payload.room_id,
    payload.message,
    selectedRoomId,
  )
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

    let es: EventSource | null = null
    let cancelled = false

    void (async () => {
      const url = await buildSseUrl('/chat_rooms/stream')
      if (!url || cancelled) return

      es = new EventSource(url)
      es.addEventListener('error', () => setSseAvailable(false))
      es.onmessage = ev => {
        const payload = parseStreamPayload(ev.data)
        const activeStoreId = storeRef.current
        if (!payload || activeStoreId == null) return
        if (payload.store_id != null && payload.store_id !== activeStoreId) return
        applyStreamEvent(qc, activeStoreId, payload, selectedRef.current)
      }
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED) setSseAvailable(false)
      }
    })()

    return () => {
      cancelled = true
      es?.close()
    }
  }, [qc, storeId])

  return { sseAvailable }
}
