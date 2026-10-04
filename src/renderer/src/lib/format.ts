import type { Language } from '@shared/types'

export const locale = (lang: Language) => (lang === 'fa' ? 'fa-IR-u-nu-latn' : 'en-US')

export function timeAgo(ts: number, lang: Language, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  const diff = (ts - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return rtf.format(Math.round(diff / (86400 * 30)), 'month')
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function dateTime(ts: number, lang: Language): string {
  return new Intl.DateTimeFormat(locale(lang), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(ts)
}

export function dateShort(ts: number, lang: Language): string {
  return new Intl.DateTimeFormat(locale(lang), { month: 'short', day: 'numeric' }).format(ts)
}

export function weekdayName(day: number, lang: Language): string {
  // 2023-01-01 was a Sunday
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'short' }).format(new Date(2023, 0, 1 + day))
}

/** Wraps a string in a left-to-right isolate so numbers like "+12" or "54%" render correctly inside RTL text. */
export const ltr = (s: string) => `\u2066${s}\u2069`

export const pct = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v) ? '—' : ltr(`${(v * 100).toFixed(digits)}%`)

export const num = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v)
    ? '—'
    : ltr(v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }))

export const signed = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v)
    ? '—'
    : ltr(`${v > 0 ? '+' : ''}${v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })}`)

export const kda = (k: number, d: number, a: number) => (k + a) / Math.max(1, d)

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const todayKey = (now = Date.now()) => {
  const d = new Date(now)
  if (d.getHours() < 5) d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TIMER_OBJ: Record<string, string> = { dragon: 'DRAGON', elder: 'ELDER', baron: 'BARON', herald: 'HERALD' }

/** Localized label for a live objective timer (keys come from the main process). */
export function timerLabel(t: (key: string) => string, tm: { key: string; label: string }): string {
  if (TIMER_OBJ[tm.key]) return t(`obj.${TIMER_OBJ[tm.key]}`)
  if (tm.key.startsWith('inhib')) return `${t('obj.INHIBITOR')} ${tm.label.replace('Inhib ', '')}`
  return tm.label
}
