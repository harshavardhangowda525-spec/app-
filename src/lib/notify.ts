import { Capacitor } from '@capacitor/core'
import type { Reminder, ScheduleBlock } from './types'
import { addDays, dateKey, parseKey, toMin } from './time'

/**
 * Notifications.
 * - Native Android (Capacitor build): exact scheduled local notifications that fire while the app is closed.
 * - Browser/PWA: only fires while Kairo is open (or recently backgrounded). Browsers cannot guarantee
 *   alarm-style delivery when the app is closed — the UI states this plainly.
 */
export const isNative = () => Capacitor.isNativePlatform()

async function nativeLN() {
  const mod = await import('@capacitor/local-notifications')
  return mod.LocalNotifications
}

export async function requestPermission(): Promise<boolean> {
  if (isNative()) {
    const LN = await nativeLN()
    const r = await LN.requestPermissions()
    return r.display === 'granted'
  }
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  return (await Notification.requestPermission()) === 'granted'
}

export interface PlannedNotice { id: number; title: string; body: string; at: Date }

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2_000_000_000 }

/** Next 2 days of task-start + reminder notices. */
export function planNotices(blocks: (d: string) => ScheduleBlock[], reminders: Reminder[], from = new Date()): PlannedNotice[] {
  const out: PlannedNotice[] = []
  const t0 = dateKey(from)
  for (let i = 0; i < 2; i++) {
    const d = addDays(t0, i)
    for (const b of blocks(d)) {
      const at = parseKey(d); const m = toMin(b.start)
      at.setHours(Math.floor(m / 60), m % 60, 0, 0)
      if (at > from) out.push({ id: hash(`${d}:${b.id}`), title: b.title, body: `Starting now · ${b.category}`, at })
    }
  }
  for (const r of reminders) {
    if (!r.active || !r.notify || !r.nextDue) continue
    const at = parseKey(r.nextDue); const m = toMin(r.time)
    at.setHours(Math.floor(m / 60), m % 60, 0, 0)
    const when = r.snoozedUntil && r.snoozedUntil > at.getTime() ? new Date(r.snoozedUntil) : at
    if (when > from) out.push({ id: hash(`rem:${r.id}:${r.nextDue}`), title: r.title, body: 'Reminder from Kairo', at: when })
  }
  return out.sort((a, b) => +a.at - +b.at).slice(0, 60)
}

let webTimers: number[] = []

export async function syncNotifications(notices: PlannedNotice[], enabled: boolean) {
  if (isNative()) {
    const LN = await nativeLN()
    const pending = await LN.getPending()
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
    if (!enabled) return
    await LN.schedule({
      notifications: notices.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } })),
    })
    return
  }
  webTimers.forEach(clearTimeout)
  webTimers = []
  if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return
  const now = Date.now()
  for (const n of notices) {
    const delay = +n.at - now
    if (delay > 0 && delay < 24 * 3600 * 1000) {
      webTimers.push(window.setTimeout(async () => {
        const reg = await navigator.serviceWorker?.getRegistration()
        if (reg) reg.showNotification(n.title, { body: n.body, icon: '/icon.svg', tag: String(n.id) })
        else new Notification(n.title, { body: n.body, icon: '/icon.svg' })
      }, delay))
    }
  }
}
