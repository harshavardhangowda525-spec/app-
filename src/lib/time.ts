export const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date key, YYYY-MM-DD (device clock). */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

export function addMonths(key: string, n: number): string {
  const d = parseKey(key)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return dateKey(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseKey(a).getTime() - parseKey(b).getTime()) / 86400000)
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function nowMin(d: Date = new Date()) {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${ap}`
}

export function fmtRange(start: string, end?: string): string {
  if (!end) return fmt12(start)
  const s = fmt12(start), e = fmt12(end)
  const sp = s.slice(-2), ep = e.slice(-2)
  return sp === ep ? `${s.slice(0, -3)} – ${e}` : `${s} – ${e}`
}

export function fmtDur(min: number): string {
  min = Math.max(0, Math.round(min))
  const h = Math.floor(min / 60), m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const weekdayShort = (key: string) => WD[parseKey(key).getDay()]
export const weekdayLong = (key: string) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseKey(key).getDay()]
export const prettyDate = (key: string) => {
  const d = parseKey(key)
  return `${d.getDate()} ${MO[d.getMonth()]}`
}
export const prettyDateLong = (key: string) => {
  const d = parseKey(key)
  return `${weekdayShort(key)}, ${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`
}

/** Monday-start week containing key. */
export function weekOf(key: string): string[] {
  const d = parseKey(key)
  const offset = (d.getDay() + 6) % 7
  const monday = addDays(key, -offset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function greeting(d: Date = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
