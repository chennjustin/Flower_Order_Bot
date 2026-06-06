import { describe, expect, it } from 'vitest'
import {
  chatRoomsQueryKey,
  ordersQueryKey,
  statsQueryKey,
} from '@/lib/storeQueryKeys'

describe('storeQueryKeys', () => {
  it('scopes React Query cache per store', () => {
    expect(ordersQueryKey(1)).toEqual(['orders', 1])
    expect(ordersQueryKey(2)).toEqual(['orders', 2])
    expect(chatRoomsQueryKey(3)).toEqual(['chatRooms', 3])
    expect(statsQueryKey(4)).toEqual(['stats', 4])
  })
})
