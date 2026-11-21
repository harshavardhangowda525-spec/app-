import type { Data } from '../store/useStore'
import { buildDay, dayStats, templateFor } from './schedule'
import { addDays, dateKey } from './time'

/** All metrics are deterministic and derived from stored records only. */

export function statsFor(data: Data, date: string, now = new Date()) {
  const template = templateFor(date, data.templates, data.settings.weekendDays)
  const items = buildDay({
    date, today: dateKey(now), nowMinutes: now.getHours() * 60 + now.getMinutes(), template,
    overrides: data.overrides, extras: data.extras, completions: data.completions, graceMin: data.settings.overdueGraceMin,
  })
  return { items, stats: dayStats(items) }
}

/** A day "has history" only if the user recorded something on it — we never fabricate past activity. */
export function hasRecords(data: Data, date: string) {
  return Object.values(data.completions).some(c => c.date === date) ||
    data.focusSessions.some(f => f.date === date)
}

export function focusMinutes(data: Data, date: string, pred: (c: string) => boolean = () => true) {
  return data.focusSessions.filter(f => f.date === date && pred(f.category)).reduce((a, f) => a + f.actualMinutes, 0)
}

export function doneOn(data: Data, date: string, blockIds: string[]) {
  return blockIds.some(id => data.completions[`${date}:${id}`]?.status === 'done')
}

export function sales(data: Data, dates: string[]) {
  const z = { calls: 0, dms: 0, interested: 0, meetings: 0, proposals: 0, won: 0 }
  for (const d of dates) {
    const s = data.sales[d]
    if (!s) continue
    z.calls += s.calls; z.dms += s.dms; z.interested += s.interested; z.meetings += s.meetings; z.proposals += s.proposals; z.won += s.won
  }
  return z
}

export function lastNDays(n: number, end = dateKey()) {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1))
}

/** Consecutive days (ending today, or yesterday if today not yet done) where pred holds. */
export function streak(pred: (d: string) => boolean, today = dateKey()) {
  let d = pred(today) ? today : addDays(today, -1)
  let n = 0
  while (pred(d) && n < 3650) { n++; d = addDays(d, -1) }
  return n
}

export function dailySummary(data: Data, date: string) {
  const { items, stats } = statsFor(data, date)
  const fm = focusMinutes(data, date)
  const study = data.studySessions.filter(s => s.date === date).reduce((a, s) => a + s.minutes, 0) +
    focusMinutes(data, date, c => c === 'Education')
  const biz = sales(data, [date])
  const tomorrow = addDays(date, 1)
  const pr = (data.priorities[tomorrow] ?? []).filter(Boolean)
  const journalPr = data.journal[date]?.answers?.[6]
  return {
    items, stats, focusMin: fm, studyMin: study, biz,
    missed: items.filter(i => i.status === 'overdue' || i.status === 'skipped'),
    tomorrowPriorities: pr.length ? pr : journalPr ? journalPr.split('\n').filter(Boolean).slice(0, 3) : [],
  }
}
