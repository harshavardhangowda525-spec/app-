import type { BulkGoal, HealthProfile, SleepRecord } from './types'

/** Daily targets from body stats (Mifflin-St Jeor × activity + goal surplus). Null until the user enters stats. */
export function targets(p: HealthProfile) {
  if (!p.weightKg || !p.heightCm || !p.age) return null
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'female' ? -161 : 5)
  const tdee = bmr * 1.55 // trains 6×/week
  const surplus: Record<BulkGoal, number> = { 'lean-bulk': 300, bulk: 500, maintain: 0 }
  const kcal = Math.round((tdee + surplus[p.goal]) / 10) * 10
  const protein = Math.round(p.weightKg * (p.goal === 'maintain' ? 1.6 : 1.9))
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat }
}
export type Targets = NonNullable<ReturnType<typeof targets>>

const MEALS_PER_DAY = 4

/** 0–10 "bulk score" for one meal — deterministic, computed by Kairo (not by the AI). */
export function bulkScore(m: { kcal: number; protein: number; carbs: number; fat: number }, t: Targets | null) {
  const perKcal = (t?.kcal ?? 2800) / MEALS_PER_DAY
  const perProtein = (t?.protein ?? 130) / MEALS_PER_DAY
  const kr = m.kcal / perKcal
  let kcalPts = Math.min(1, kr) * 4
  if (kr > 1.7) kcalPts -= 1 // very heavy meal: fine for bulking but spread it out
  const protPts = Math.min(1, m.protein / perProtein) * 4
  const fatShare = m.kcal ? (m.fat * 9) / m.kcal : 0
  const balPts = (m.carbs > 15 ? 1 : 0) + (fatShare <= 0.4 ? 1 : 0)
  const score = Math.max(0, Math.min(10, kcalPts + protPts + balPts))
  const verdict = score >= 8 ? 'Great for muscle gain' : score >= 6 ? 'Good for your bulk' : score >= 4 ? 'Light for a bulk' : 'Not bulk-friendly'
  const tips: string[] = []
  const pGap = Math.round(perProtein - m.protein)
  const kGap = Math.round(perKcal - m.kcal)
  if (pGap >= 8) tips.push(`Add ~${pGap} g protein — 2 eggs, 100 g paneer or a scoop of whey.`)
  if (kGap >= 120) tips.push(`Add ~${kGap} kcal — a glass of milk, or a banana with peanut butter.`)
  if (fatShare > 0.4) tips.push('Fat-heavy — balance it with rice, roti or fruit.')
  if (!tips.length) tips.push(m.protein >= perProtein ? `High protein (${Math.round(m.protein)} g) and a solid surplus — keep it up.` : 'Well balanced meal.')
  return { score: Math.round(score * 10) / 10, verdict, tip: tips[0] }
}

export const sum = <T extends { kcal: number; protein: number; carbs: number; fat: number }>(xs: T[]) =>
  xs.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

// ---------- Sleep from screen events (Android) ----------
export interface ScreenEvent { ts: number; type: 'on' | 'off' }

/**
 * Detect last night's sleep from screen on/off events between 9:30 PM and noon.
 * Idle gaps ≥ 20 min are sleep candidates; gaps separated by ≤ 10 min of phone use merge
 * (each such pick-up counts as a wake-up). The block with the most idle time is the night's sleep.
 */
export function detectSleep(events: ScreenEvent[], windowStart: number, windowEnd: number, startsOn = false) {
  const ev = events.filter(e => e.ts >= windowStart && e.ts <= windowEnd).sort((a, b) => a.ts - b.ts)
  const timeline: { start: number; end: number; type: 'idle' | 'used' }[] = []
  let on = startsOn, t = windowStart
  for (const e of ev) {
    const isOn = e.type === 'on'
    if (isOn === on) continue
    if (e.ts > t) timeline.push({ start: t, end: e.ts, type: on ? 'used' : 'idle' })
    on = isOn; t = e.ts
  }
  if (windowEnd > t) timeline.push({ start: t, end: windowEnd, type: on ? 'used' : 'idle' })

  const MIN = 60000
  const idle = timeline.filter(s => s.type === 'idle' && s.end - s.start >= 20 * MIN)
  const blocks: { start: number; end: number; idleMs: number; wakeUps: number }[] = []
  for (const g of idle) {
    const last = blocks[blocks.length - 1]
    if (last && g.start - last.end <= 10 * MIN) { last.idleMs += g.end - g.start; last.end = g.end; last.wakeUps++ }
    else blocks.push({ start: g.start, end: g.end, idleMs: g.end - g.start, wakeUps: 0 })
  }
  const best = blocks.sort((a, b) => b.idleMs - a.idleMs)[0]
  if (!best || best.idleMs < 2 * 60 * MIN) return null
  return { sleepStart: best.start, wake: best.end, asleepMin: Math.round(best.idleMs / MIN), wakeUps: best.wakeUps, timeline }
}

/** 0–100: duration (60) + few wake-ups (15) + regular bedtime (15) + how rested you felt (10). */
export function sleepScore(r: Pick<SleepRecord, 'asleepMin' | 'wakeUps' | 'sleepStart' | 'rested'>, goalMin = 450) {
  const dur = Math.min(1, r.asleepMin / goalMin) * 60
  const wk = Math.max(0, 15 - r.wakeUps * 5)
  const bed = new Date(r.sleepStart)
  let bedMin = bed.getHours() * 60 + bed.getMinutes()
  if (bedMin < 12 * 60) bedMin += 24 * 60
  const lateBy = Math.max(0, bedMin - (23 * 60 + 30)), earlyBy = Math.max(0, 21 * 60 + 30 - bedMin)
  const reg = Math.max(0, 15 - Math.ceil((lateBy + earlyBy) / 30) * 5)
  const rest = r.rested ? ((r.rested - 1) / 4) * 10 : 5
  return Math.round(dur + wk + reg + rest)
}
export const sleepLabel = (s: number) => (s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 55 ? 'Fair' : 'Poor')
