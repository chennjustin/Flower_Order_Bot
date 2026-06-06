/**
 * Normalize LINE Official Account Basic ID for display.
 * LINE API usually includes the @ prefix; this helper guarantees it.
 */
export function formatLineBasicId(basicId: string | null | undefined): string | null {
  const trimmed = (basicId ?? '').trim()
  if (!trimmed) {
    return null
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}
