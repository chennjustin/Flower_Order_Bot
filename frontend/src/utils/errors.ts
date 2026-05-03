import axios from 'axios'

/** Best-effort user-facing detail string for Axios / Error / unknown rejects. */
export function getErrorDetail(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const raw = err.response?.data as { detail?: unknown } | undefined
    if (raw && raw.detail !== undefined) return String(raw.detail)
    return err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}
