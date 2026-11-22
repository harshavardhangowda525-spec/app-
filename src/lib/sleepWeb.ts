/**
 * Sleep tracking for the web app (Vercel). A website can't see phone use while it's closed, so Kairo uses
 * what it can observe: a "Good night" tap (exact bedtime), otherwise the last time Kairo was used after
 * 9:30 PM; and the first time Kairo is opened the next morning as the wake-up. The user confirms in a
 * one-tap morning check-in (times are editable). Stored only on this device until saved as a record.
 */
import { addDays, dateKey, parseKey } from './time'

const BED = 'kairo-bed-at'
const NIGHT_ACTIVE = 'kairo-night-active'
const MORNING_OPEN = 'kairo-morning-open'
const get = (k: string) => { try { return Number(localStorage.getItem(k)) || 0 } catch { return 0 } }
const set = (k: string, v: number) => { try { localStorage.setItem(k, String(v)) } catch { /* ignore */ } }
const del = (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } }

const minutesOfDay = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes() }
const isNight = (t: number) => { const m = minutesOfDay(t); return m >= 21 * 60 + 30 || m < 4 * 60 }
const isMorning = (t: number) => { const m = minutesOfDay(t); return m >= 4 * 60 && m < 14 * 60 }

/** Call on every interaction / visibility change. Cheap: localStorage only. */
export function noteActivity(now = Date.now()) {
  if (isNight(now)) set(NIGHT_ACTIVE, now)
  if (isMorning(now)) {
    const first = get(MORNING_OPEN)
    if (!first || dateKey(new Date(first)) !== dateKey(new Date(now))) set(MORNING_OPEN, now)
  }
}

export const goodNight = (now = Date.now()) => set(BED, now)
export const bedTapped = () => get(BED)
export const isBedtimeWindow = (now = new Date()) => { const m = now.getHours() * 60 + now.getMinutes(); return m >= 21 * 60 || m < 3 * 60 }

/** Best estimate of last night for the morning check-in. Null if nothing usable was observed. */
export function estimateLastNight(today = dateKey(), now = Date.now()) {
  const nightStart = parseKey(addDays(today, -1)).getTime() + 18 * 3600e3 // yesterday 6 PM
  const morningEnd = parseKey(today).getTime() + 14 * 3600e3 // today 2 PM
  const bedTap = get(BED), lastNight = get(NIGHT_ACTIVE), wakeOpen = get(MORNING_OPEN)
  const inWindow = (t: number) => t >= nightStart && t <= morningEnd
  const bed = inWindow(bedTap) ? { at: bedTap, how: 'tap' as const } : inWindow(lastNight) ? { at: lastNight, how: 'last-use' as const } : null
  const wake = inWindow(wakeOpen) && (!bed || wakeOpen > bed.at) ? wakeOpen : Math.min(now, morningEnd)
  return { bed, wake, wakeHow: inWindow(wakeOpen) ? ('first-open' as const) : ('now' as const) }
}

export function clearNight() { del(BED); del(NIGHT_ACTIVE) }
