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
  owner_display_name: string | null
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
  ownerDisplayName: string | null
  lineOfficial: LineOfficialDisplay
}

interface UpdateOwnerDisplayNameApiRequest {
  owner_display_name: string
}

interface UpdateOwnerDisplayNameApiResponse {
  owner_display_name: string
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
    ownerDisplayName: data.owner_display_name,
    lineOfficial: {
      displayName: data.line_official.display_name,
      basicId: data.line_official.basic_id,
      userId: data.line_official.user_id,
      imageUrl: data.line_official.image_url,
    },
  }
}

export async function updateMyOwnerDisplayName(name: string): Promise<string> {
  const payload: UpdateOwnerDisplayNameApiRequest = {
    owner_display_name: name,
  }
  const { data } = await api.patch<UpdateOwnerDisplayNameApiResponse>(
    '/stores/me/owner-display-name',
    payload,
  )
  return data.owner_display_name
}
