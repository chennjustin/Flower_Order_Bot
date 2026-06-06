import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { roomMessagesQueryKey } from '@/lib/storeQueryKeys'

const DELTA_SYNC_MS = 10_000

/** Fallback when Redis SSE is unavailable: poll incremental sync while tab is visible. */
export function useVisibleRoomDeltaSync(
  storeId: number | null,
  roomId: number | null,
  enabled: boolean,
) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled || roomId == null || storeId == null) return

    const key = roomMessagesQueryKey(storeId, roomId)

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      void qc.refetchQueries({ queryKey: key })
    }

    tick()
    const intervalId = window.setInterval(tick, DELTA_SYNC_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, roomId, storeId, qc])
}
