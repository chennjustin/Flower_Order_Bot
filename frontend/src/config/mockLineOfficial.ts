import type { LineOfficialDisplay } from '@/types/authApi'

/**
 * Placeholder LINE Official Account display for onboarding Step 2.
 * Replace with GET /stores/{storeKey}/line-official-display when backend is ready.
 */
export const MOCK_LINE_OFFICIAL: LineOfficialDisplay = {
  displayName: '奇美花店 Chi-Mei Floral',
  // Public placeholder image; swap for store-specific asset later.
  imageUrl:
    'https://placehold.co/240x240/e4e7ff/6168fc/png?text=LINE+OA&font=noto-sans',
}

/** Resolve mock display by store key (multi-store hook for future API). */
export function getMockLineOfficialDisplay(_storeKey: string): LineOfficialDisplay {
  return MOCK_LINE_OFFICIAL
}
