import { api } from '@/api/client'

export interface CalendarStatus {
  connected: boolean
  email: string | null
}

/** Current Google Calendar connection state for the logged-in store. */
export async function fetchCalendarStatus(): Promise<CalendarStatus> {
  const { data } = await api.get<CalendarStatus>('/google/calendar/status')
  return data
}

/** Start the Google consent flow by navigating to the returned authorization URL. */
export async function startCalendarConnect(): Promise<void> {
  const { data } = await api.get<{ authorization_url: string }>('/google/calendar/connect')
  window.location.href = data.authorization_url
}

/** Revoke and forget the stored Google Calendar credentials. */
export async function disconnectCalendar(): Promise<CalendarStatus> {
  const { data } = await api.post<CalendarStatus>('/google/calendar/disconnect')
  return data
}

export interface BackfillResult {
  /** Number of existing orders newly pushed to the calendar. */
  synced: number
  /** Total non-cancelled orders considered. */
  total: number
}

/** Push existing (non-cancelled, dated, not-yet-synced) orders to the calendar. */
export async function syncExistingOrders(): Promise<BackfillResult> {
  const { data } = await api.post<BackfillResult>('/google/calendar/sync-existing')
  return data
}
