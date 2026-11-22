import type { Data } from '../store/useStore'
import type { ActivityInstance, Category, QuarterGoal, StudySubject, TradeJournalEntry, WeightEntry } from './types'
import { statsFor, hasRecords, focusMinutes, sales } from './analytics'
import { sum, targets } from './health'
import { addDays, dateKey, fromMin, parseKey, toMin, weekOf } from './time'

/** Everything here is deterministic and computed only from stored records — nothing is invented. */

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const recordedDays = (data: Data, days: string[], today = dateKey()) => days.filter(d => d <= today && (hasRecords(data, d) || d === today))

/* ---------------- 1. weekly report ---------------- */

export interface WeekMetrics {
  days: string[]; done: number; eligible: number; pct: number
  byCategory: Record<string, { done: number; eligible: number; pct: number }>
  focusMin: number; sleepAvg: number | null; kcalAvg: number | null; proteinAvg: number | null
  funnel: { touches: number; interested: number; meetings: number; proposals: number; won: number }
  missed: { title: string; n: number }[]; reliable: { title: string; rate: number; n: number }[]
  gymDays: number; studyDays: number; distractionsPerSession: number | null
}

export function weekMetrics(data: Data, anyDayInWeek: string, today = dateKey()): WeekMetrics {
  const days = weekOf(anyDayInWeek)
  const rec = recordedDays(data, days, today)
  const byCategory: WeekMetrics['byCategory'] = {}
  const perBlock = new Map<string, { title: string; done: number; total: number; missed: number }>()
  let done = 0, eligible = 0, gymDays = 0, studyDays = 0
  for (const d of rec) {
    const { items } = statsFor(data, d)
    for (const i of items) {
      if (i.status === 'moved' || (d === today && (i.status === 'upcoming' || i.status === 'active'))) continue
      eligible++
      const c = (byCategory[i.category] ??= { done: 0, eligible: 0, pct: 0 })
      c.eligible++
      const b = perBlock.get(i.id) ?? { title: i.title, done: 0, total: 0, missed: 0 }
      b.total++
      if (i.status === 'done') { done++; c.done++; b.done++ }
      if (i.status === 'overdue' || i.status === 'skipped') b.missed++
      perBlock.set(i.id, b)
    }
    if (items.some(i => i.category === 'Fitness' && i.status === 'done')) gymDays++
    if (items.some(i => i.module === 'study' && i.status === 'done') || data.studySessions.some(s => s.date === d)) studyDays++
  }
  for (const c of Object.values(byCategory)) c.pct = pct(c.done, c.eligible)
  const sleeps = data.sleeps.filter(s => days.includes(s.date))
  const mealDays = days.filter(d => data.meals.some(m => m.date === d))
  const s = sales(data, days)
  const sessions = data.focusSessions.filter(f => days.includes(f.date))
  const blocks = [...perBlock.values()].filter(b => b.total >= 2)
  return {
    days, done, eligible, pct: pct(done, eligible), byCategory,
    focusMin: days.reduce((a, d) => a + focusMinutes(data, d), 0),
    sleepAvg: sleeps.length ? Math.round(avg(sleeps.map(x => x.score))) : null,
    kcalAvg: mealDays.length ? Math.round(avg(mealDays.map(d => sum(data.meals.filter(m => m.date === d)).kcal))) : null,
    proteinAvg: mealDays.length ? Math.round(avg(mealDays.map(d => sum(data.meals.filter(m => m.date === d)).protein))) : null,
    funnel: { touches: s.calls + s.dms, interested: s.interested, meetings: s.meetings, proposals: s.proposals, won: s.won },
    missed: blocks.filter(b => b.missed > 0).sort((a, b) => b.missed - a.missed).slice(0, 3).map(b => ({ title: b.title, n: b.missed })),
    reliable: blocks.map(b => ({ title: b.title, rate: pct(b.done, b.total), n: b.total })).filter(b => b.rate >= 50).sort((a, b) => b.rate - a.rate || b.n - a.n).slice(0, 3),
    gymDays, studyDays,
    distractionsPerSession: sessions.length ? Math.round(avg(sessions.map(x => x.distractions ?? 0)) * 10) / 10 : null,
  }
}

/* ---------------- 2. what moves your numbers ---------------- */

export interface Correlation { id: string; text: string; a: number; b: number; nA: number; nB: number; unit: string }

/** Compare two groups of days; only reported when each group has at least `min` days. */
function compare(days: string[], inA: (d: string) => boolean | null, value: (d: string) => number | null, min = 3) {
  const A: number[] = [], B: number[] = []
  for (const d of days) {
    const g = inA(d), v = value(d)
    if (g === null || v === null) continue
    ;(g ? A : B).push(v)
  }
  return A.length >= min && B.length >= min ? { a: Math.round(avg(A)), b: Math.round(avg(B)), nA: A.length, nB: B.length } : null
}

export function correlations(data: Data, lookback = 42, today = dateKey()): Correlation[] {
  const days = Array.from({ length: lookback }, (_, i) => addDays(today, -i - 1)).filter(d => hasRecords(data, d))
  const completion = (d: string) => statsFor(data, d).stats.pct
  const sleepOf = (d: string) => data.sleeps.find(s => s.date === d)
  const out: Correlation[] = []
  const t = targets(data.healthProfile)

  const c1 = compare(days, d => { const s = sleepOf(d); return s ? s.asleepMin >= 420 : null }, completion)
  if (c1) out.push({ id: 'sleep', ...c1, unit: '%', text: `After 7h+ sleep you complete ${c1.a}% of your schedule vs ${c1.b}% after shorter nights.` })

  const outreach = (d: string) => { const s = data.sales[d]; return s ? s.calls + s.dms : null }
  const c2 = compare(days, d => focusMinutes(data, d, c => c === 'Development') >= 90, outreach)
  if (c2) out.push({ id: 'dev-outreach', ...c2, unit: ' touches', text: `On days with 90+ min of dev focus you make ${c2.a} outreach touches vs ${c2.b} on other days.` })

  if (t) {
    const c3 = compare(days, d => { const m = data.meals.filter(x => x.date === d); return m.length ? sum(m).protein >= t.protein * 0.9 : null }, completion)
    if (c3) out.push({ id: 'protein', ...c3, unit: '%', text: `Days you hit your protein target: ${c3.a}% schedule completion vs ${c3.b}% when you don't.` })
  }

  const c4 = compare(days, d => { const done = data.completions[`${d}:gym`] ?? data.completions[`${d}:we-gym`]; return done ? done.status === 'done' : null }, completion)
  if (c4) out.push({ id: 'gym', ...c4, unit: '%', text: `Gym days: ${c4.a}% completion vs ${c4.b}% on days you skip the gym.` })

  const energyAvg = (d: string) => { const e = data.energy.filter(x => x.date === d); return e.length ? Math.round(avg(e.map(x => x.level)) * 33) : null }
  const c5 = compare(days, d => { const s = sleepOf(d); return s ? s.asleepMin >= 420 : null }, energyAvg)
  if (c5) out.push({ id: 'sleep-energy', ...c5, unit: '', text: `Energy after 7h+ sleep averages ${c5.a}/100 vs ${c5.b}/100 after shorter nights.` })

  const c6 = compare(days, d => focusMinutes(data, d) >= 120, completion)
  if (c6) out.push({ id: 'focus', ...c6, unit: '%', text: `Days with 2h+ of focus sessions: ${c6.a}% completion vs ${c6.b}% otherwise.` })

  return out.sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))
}

/* ---------------- 5. plan vs reality ---------------- */

export interface BlockTiming { id: string; title: string; scheduled: string; n: number; onTimePct: number; avgDelay: number; suggestion?: string }

/** Uses recorded actual starts (Start button / linked focus session). Blocks need ≥3 recorded starts. */
export function planVsReality(data: Data, lookback = 28, today = dateKey()): BlockTiming[] {
  const byBlock = new Map<string, { title: string; scheduled: number; delays: number[] }>()
  for (let i = 0; i < lookback; i++) {
    const d = addDays(today, -i)
    if (!Object.keys(data.blockStarts).some(k => k.startsWith(d))) continue
    const { items } = statsFor(data, d)
    for (const it of items) {
      const started = data.blockStarts[it.key]
      if (!started) continue
      const delay = Math.round((started - (parseKey(d).getTime() + it.startMin * 60e3)) / 60e3)
      const b = byBlock.get(it.id) ?? { title: it.title, scheduled: toMin(it.start), delays: [] }
      b.delays.push(delay)
      byBlock.set(it.id, b)
    }
  }
  return [...byBlock.entries()].filter(([, b]) => b.delays.length >= 3).map(([id, b]) => {
    const avgDelay = Math.round(avg(b.delays))
    const onTimePct = pct(b.delays.filter(x => x <= 10).length, b.delays.length)
    const sorted = [...b.delays].sort((x, y) => x - y)
    const typical = Math.round(sorted[Math.floor(sorted.length / 2)] / 15) * 15
    return {
      id, title: b.title, scheduled: fromMin(b.scheduled), n: b.delays.length, onTimePct, avgDelay,
      suggestion: typical >= 15 && onTimePct < 50 ? `You usually start ~${typical} min late — consider moving it to ${fromMin(b.scheduled + typical)}.` : undefined,
    }
  }).sort((a, b) => b.avgDelay - a.avgDelay)
}

/* ---------------- energy peaks ---------------- */

export function energyByHour(data: Data, lookback = 28, today = dateKey()) {
  const from = addDays(today, -lookback)
  const logs = data.energy.filter(e => e.date >= from)
  const hours = new Map<number, number[]>()
  for (const e of logs) { const h = new Date(e.at).getHours(); hours.set(h, [...(hours.get(h) ?? []), e.level]) }
  const rows = [...hours.entries()].map(([h, v]) => ({ hour: h, avg: Math.round(avg(v) * 100) / 100, n: v.length })).sort((a, b) => a.hour - b.hour)
  const peaks = rows.filter(r => r.n >= 2).sort((a, b) => b.avg - a.avg).slice(0, 3)
  return { rows, peaks, total: logs.length }
}

/* ---------------- NIOS revision (spaced) ---------------- */

export const REVISION_OFFSETS = [1, 3, 7, 21]
export interface RevisionDue { subjectId: string; subject: string; chapterId: string; chapter: string; round: number; due: string; overdueDays: number }

export function revisionsDue(subjects: StudySubject[], today = dateKey()): RevisionDue[] {
  const out: RevisionDue[] = []
  for (const s of subjects) {
    if (s.archived) continue
    for (const c of s.chapters) {
      if (!c.done || !c.doneAt) continue
      const round = (c.revisedAt ?? []).length
      if (round >= REVISION_OFFSETS.length) continue
      const base = round === 0 ? c.doneAt : c.revisedAt![round - 1]
      const gap = round === 0 ? REVISION_OFFSETS[0] : REVISION_OFFSETS[round] - REVISION_OFFSETS[round - 1]
      const due = addDays(dateKey(new Date(base)), gap)
      if (due <= today) out.push({ subjectId: s.id, subject: s.name, chapterId: c.id, chapter: c.name, round: round + 1, due, overdueDays: Math.round((parseKey(today).getTime() - parseKey(due).getTime()) / 864e5) })
    }
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays)
}

export function syllabusCoverage(subjects: StudySubject[]) {
  const ch = subjects.filter(s => !s.archived).flatMap(s => s.chapters)
  return { done: ch.filter(c => c.done).length, total: ch.length, pct: pct(ch.filter(c => c.done).length, ch.length) }
}

/* ---------------- trading stats ---------------- */

/** Realised R for a closed trade: (exit − entry) / risk, sign by direction. Falls back to −1 / +planned R. */
export function realisedR(t: TradeJournalEntry): number | null {
  if (t.outcome === 'Open') return null
  if (t.entry != null && t.stopLoss != null) {
    const risk = Math.abs(t.entry - t.stopLoss)
    if (risk && t.exit != null) return Math.round((((t.exit - t.entry) * (t.direction === 'Long' ? 1 : -1)) / risk) * 100) / 100
    if (risk && t.outcome === 'Loss') return -1
    if (risk && t.outcome === 'Win' && t.target != null) return Math.round((Math.abs(t.target - t.entry) / risk) * 100) / 100
  }
  return t.outcome === 'Breakeven' ? 0 : t.outcome === 'Loss' ? -1 : null
}

export function setupStats(trades: TradeJournalEntry[]) {
  const by = new Map<string, TradeJournalEntry[]>()
  for (const t of trades) by.set(t.setup?.trim() || 'No setup', [...(by.get(t.setup?.trim() || 'No setup') ?? []), t])
  return [...by.entries()].map(([setup, ts]) => {
    const closed = ts.filter(t => t.outcome !== 'Open')
    const rs = closed.map(realisedR).filter((x): x is number => x !== null)
    return {
      setup, n: ts.length, closed: closed.length,
      winRate: pct(closed.filter(t => t.outcome === 'Win').length, closed.length),
      avgR: rs.length ? Math.round(avg(rs) * 100) / 100 : null,
      expectancy: rs.length ? Math.round(avg(rs) * 100) / 100 : null,
    }
  }).sort((a, b) => b.n - a.n)
}

export function realReadiness(paper: TradeJournalEntry[]) {
  const closed = paper.filter(t => t.outcome !== 'Open')
  const rs = closed.map(realisedR).filter((x): x is number => x !== null)
  const losses = closed.filter(t => t.outcome === 'Loss')
  const checks = [
    { label: '30+ closed paper trades', ok: closed.length >= 30, value: `${closed.length}/30` },
    { label: 'Win rate ≥ 45%', ok: closed.length >= 10 && pct(closed.filter(t => t.outcome === 'Win').length, closed.length) >= 45, value: `${pct(closed.filter(t => t.outcome === 'Win').length, closed.length)}%` },
    { label: 'Positive expectancy (≥ +0.2R)', ok: rs.length >= 10 && avg(rs) >= 0.2, value: rs.length ? `${(Math.round(avg(rs) * 100) / 100).toFixed(2)}R` : '—' },
    { label: 'Stop-loss on every trade', ok: paper.length > 0 && paper.every(t => t.stopLoss != null), value: `${paper.filter(t => t.stopLoss != null).length}/${paper.length}` },
    { label: 'Mistakes journaled on 80%+ of losses', ok: losses.length > 0 && pct(losses.filter(t => t.mistakes?.trim()).length, losses.length) >= 80, value: `${pct(losses.filter(t => t.mistakes?.trim()).length, losses.length)}%` },
  ]
  return { checks, ready: checks.every(c => c.ok) }
}

/* ---------------- 3. bulk progress ---------------- */

/** kg/week from a least-squares fit over the last `days`. Needs ≥3 weigh-ins spanning ≥10 days. */
export function weightTrend(weights: WeightEntry[], days = 28, today = dateKey()) {
  const from = addDays(today, -days)
  const w = weights.filter(x => x.date >= from).sort((a, b) => a.date.localeCompare(b.date))
  if (w.length < 3) return null
  const t0 = parseKey(w[0].date).getTime()
  const xs = w.map(x => (parseKey(x.date).getTime() - t0) / 864e5), ys = w.map(x => x.kg)
  if (xs[xs.length - 1] < 10) return null
  const mx = avg(xs), my = avg(ys)
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  return { perWeek: Math.round(slope * 7 * 100) / 100, latest: w[w.length - 1].kg, n: w.length }
}

/** Suggested calorie change to keep the bulk on track (deterministic rule). */
export function calorieAdvice(perWeek: number | null, goal: Data['healthProfile']['goal']) {
  if (perWeek === null) return null
  const [lo, hi] = goal === 'bulk' ? [0.4, 0.75] : goal === 'lean-bulk' ? [0.2, 0.5] : [-0.15, 0.15]
  if (perWeek < lo) return { delta: 150, text: `Gaining ${perWeek} kg/week — below the ${lo}–${hi} kg target. Add ~150 kcal/day.` }
  if (perWeek > hi) return { delta: -150, text: `Gaining ${perWeek} kg/week — faster than ${hi} kg (more fat). Trim ~150 kcal/day.` }
  return { delta: 0, text: `Gaining ${perWeek} kg/week — right in the ${lo}–${hi} kg range. Keep calories as they are.` }
}

/** Personal records: best weight×reps (estimated 1RM, Epley) per exercise. */
export function personalRecords(data: Data) {
  const best = new Map<string, { e1rm: number; kg: number; reps: number; date: string }>()
  for (const w of data.workouts) for (const ex of w.exercises) for (const s of ex.sets) {
    if (!s.kg || !s.reps) continue
    const e1rm = Math.round(s.kg * (1 + s.reps / 30) * 10) / 10
    const k = ex.name.trim().toLowerCase()
    const cur = best.get(k)
    if (!cur || e1rm > cur.e1rm) best.set(k, { e1rm, kg: s.kg, reps: s.reps, date: w.date })
  }
  return best
}

/** Top-set e1RM per session for one exercise (progressive overload chart). */
export function exerciseHistory(data: Data, name: string) {
  const k = name.trim().toLowerCase()
  return data.workouts.filter(w => w.exercises.some(e => e.name.trim().toLowerCase() === k)).sort((a, b) => a.date.localeCompare(b.date)).map(w => {
    const sets = w.exercises.filter(e => e.name.trim().toLowerCase() === k).flatMap(e => e.sets)
    return { date: w.date, e1rm: Math.max(0, ...sets.map(s => Math.round(s.kg * (1 + s.reps / 30) * 10) / 10)), volume: sets.reduce((a, s) => a + s.kg * s.reps, 0) }
  })
}

/* ---------------- quarterly goals ---------------- */

export const quarterOf = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`
export function quarterRange(q: string) {
  const [y, n] = [Number(q.slice(0, 4)), Number(q.slice(-1))]
  const start = `${y}-${String((n - 1) * 3 + 1).padStart(2, '0')}-01`
  const end = addDays(n === 4 ? `${y + 1}-01-01` : `${y}-${String(n * 3 + 1).padStart(2, '0')}-01`, -1)
  return { start, end }
}

export function goalProgress(g: QuarterGoal, data: Data) {
  const { start, end } = quarterRange(g.quarter)
  const inQ = (d: string) => d >= start && d <= end
  const cats = new Set<Category>(g.categories)
  const tasks = Object.values(data.completions).filter(c => c.status === 'done' && inQ(c.date) && cats.has(c.category)).length
  const focus = data.focusSessions.filter(f => inQ(f.date) && cats.has(f.category)).reduce((a, f) => a + f.actualMinutes, 0)
  const ms = g.milestones.length ? pct(g.milestones.filter(m => m.done).length, g.milestones.length) : null
  return { tasks, focusMin: focus, milestonePct: ms }
}

/* ---------------- helpers for UI ---------------- */

export const followUpsDue = (data: Data, today = dateKey()) =>
  data.leads.filter(l => l.nextFollowUp && l.nextFollowUp <= today && l.stage !== 'Won' && l.stage !== 'Lost')

export const weekKey = (d: string) => weekOf(d)[0]
export type { ActivityInstance }
