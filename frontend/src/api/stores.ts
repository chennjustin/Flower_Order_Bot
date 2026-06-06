import { api } from '@/api/client'
import type { LineOfficialDisplay } from '@/types/authApi'

export interface StoreListItem {
  id: number
  name: string
  slug: string | null
}

interface StoreOnboardingContextApiResponse {
  id: number
  name: string
  slug: string | null
  line_official: {
    display_name: string
    basic_id: string | null
    user_id: string | null
    image_url: string | null
  }
}

export interface StoreOnboardingContext {
  id: number
  storeName: string
  slug: string | null
  lineOfficial: LineOfficialDisplay
}

/** OAuth-bound store for the logged-in owner. */
export async function fetchMyStore(): Promise<StoreListItem> {
  const { data } = await api.get<StoreListItem>('/stores/me')
  return data
}

/** Onboarding display context for the logged-in owner and their bound store. */
export async function fetchMyStoreOnboardingContext(): Promise<StoreOnboardingContext> {
  const { data } = await api.get<StoreOnboardingContextApiResponse>(
    '/stores/me/onboarding-context',
  )

  return {
    id: data.id,
    storeName: data.name,
    slug: data.slug,
    lineOfficial: {
      displayName: data.line_official.display_name,
      basicId: data.line_official.basic_id,
      userId: data.line_official.user_id,
      imageUrl: data.line_official.image_url ?? '',
    },
  }
}
