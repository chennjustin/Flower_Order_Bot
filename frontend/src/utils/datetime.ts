const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Header date label, e.g. `5 月 8 日 (五)`. */
export function formatHeaderDate(date: Date): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 (${WEEKDAYS_ZH[date.getDay()]})`
}

/** Cell datetime, e.g. `26/05/08（五）14:30`. Empty input -> empty string. */
export function formatCellDateTime(input: string | Date | null | undefined): string {
  if (!input) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear().toString().slice(-2)
  return `${year}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}（${WEEKDAYS_ZH[d.getDay()]}）${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** ISO date prefix (YYYY-MM-DD) in local time. */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
