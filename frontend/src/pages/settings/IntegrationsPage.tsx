import { useEffect, useState } from 'react'
import { Calendar, CheckCircle2, Link2, RefreshCw, Unlink } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import {
  disconnectCalendar,
  fetchCalendarStatus,
  startCalendarConnect,
  syncExistingOrders,
  type CalendarStatus,
} from '@/api/googleCalendar'

export default function IntegrationsPage() {
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  async function runBackfill(prefix?: string) {
    setSyncing(true)
    setError(null)
    try {
      const r = await syncExistingOrders()
      setBanner(`${prefix ?? ''}已同步 ${r.synced} 筆既有訂單到 Google 日曆（共 ${r.total} 筆）`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    // Read the OAuth callback result, then strip it from the URL.
    const params = new URLSearchParams(window.location.search)
    const calendar = params.get('calendar')
    if (calendar) {
      params.delete('calendar')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }

    async function init() {
      setLoading(true)
      try {
        const st = await fetchCalendarStatus()
        setStatus(st)
        setError(null)
        // Just connected → also pull existing orders onto the calendar.
        if (calendar === 'connected' && st.connected) {
          await runBackfill('已成功連結 Google 日曆，')
        } else if (calendar === 'missing_scope') {
          setError(
            '未取得 Google 日曆權限。請在 Google 同意畫面勾選日曆存取權（並確認 Cloud Console 的 OAuth 同意畫面已加入 calendar.events 範圍）後，再重新連結。',
          )
        } else if (calendar === 'error') {
          setError('連結 Google 日曆失敗，請再試一次')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnect() {
    setBusy(true)
    setError(null)
    try {
      await startCalendarConnect() // navigates the browser to Google
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('確定要取消連結 Google 日曆嗎？已同步的訂單事件將不再更新。')) return
    setBusy(true)
    setError(null)
    try {
      setStatus(await disconnectCalendar())
      setBanner('已取消連結 Google 日曆')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const connected = status?.connected ?? false

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PageHeader title="Google 日曆" />
      <div className="flex justify-center px-4 pb-12 pt-[160px]">
        <section className="w-full max-w-[640px] rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EEF0FF] text-[#6168FC]">
              <Calendar className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">Google 日曆同步</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                連結後，已確認且有取貨時間的訂單會自動建立日曆事件；修改取貨時間或取消訂單時也會同步更新。連結時會一併把既有訂單同步到日曆。
              </p>
            </div>
          </div>

          {banner && (
            <div className="mt-6 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {banner}
            </div>
          )}
          {error && (
            <div className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</div>
          )}

          <div className="mt-6 border-t border-gray-100 pt-6">
            {loading ? (
              <p className="text-sm text-gray-400">載入中…</p>
            ) : connected ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> 已連結
                  </span>
                  {status?.email && <span className="ml-2 text-gray-500">{status.email}</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => runBackfill()}
                    disabled={syncing || busy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? '同步中…' : '同步現有訂單'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={busy || syncing}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Unlink className="h-4 w-4" />
                    取消連結
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-500">尚未連結</span>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6168FC] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4f56e0] disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" />
                  連結 Google 日曆
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
