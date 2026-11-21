import type {
  ActivityCompletion, ActivityInstance, DayOverride, ExtraActivity, ScheduleBlock, ScheduleTemplate,
} from './types'
import { parseKey, toMin } from './time'

export const POINT_TASK_MIN = 15 // window for tasks without an end time (wake, sleep)

export function templateFor(date: string, templates: ScheduleTemplate[], weekendDays: number[]): ScheduleTemplate {
  const isWeekend = weekendDays.includes(parseKey(date).getDay())
  return templates.find(t => t.kind === (isWeekend ? 'weekend' : 'weekday')) ?? templates[0]
}

/**
 * Build the day's activity list: template blocks + per-date overrides + one-off extras,
 * annotated with live status from the device clock and stored completions.
 * Never infers "done" from time passing: past + no record => overdue.
 */
export function buildDay(opts: {
  date: string
  today: string
  nowMinutes: number
  template: ScheduleTemplate
  overrides: DayOverride[]
  extras: ExtraActivity[]
  completions: Record<string, ActivityCompletion>
  graceMin?: number
}): ActivityInstance[] {
  const { date, today, nowMinutes, template, overrides, extras, completions, graceMin = 0 } = opts
  const ov = new Map(overrides.filter(o => o.date === date).map(o => [o.blockId, o]))
  const list: ActivityInstance[] = []

  const push = (blk: ScheduleBlock, extra: boolean) => {
    const o = ov.get(blk.id)
    if (o?.removed) return
    const start = o?.start ?? blk.start
    const end = o?.end ?? blk.end
    const startMin = toMin(start)
    const endMin = end ? toMin(end) : startMin + POINT_TASK_MIN
    const key = `${date}:${blk.id}`
    const completion = completions[key]
    let status: ActivityInstance['status']
    if (completion) status = completion.status
    else if (date < today) status = 'overdue'
    else if (date > today) status = 'upcoming'
    else if (nowMinutes >= endMin + graceMin) status = 'overdue'
    else if (nowMinutes >= startMin) status = 'active'
    else status = 'upcoming'
    list.push({
      ...blk, title: o?.title ?? blk.title, start, end, key, date, startMin, endMin, status,
      rescheduled: !!(o && (o.start || o.end)), extra, completion,
    })
  }

  template.blocks.forEach(b => push(b, false))
  extras.filter(e => e.date === date).forEach(e => push(e, true))
  return list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
}

export interface DayStats {
  total: number
  eligible: number
  done: number
  skipped: number
  overdue: number
  moved: number
  rescheduled: number
  pct: number
}

/** completion % = done / eligible × 100. Moved-to-another-day items are not eligible; skipped stay eligible but never count as done. */
export function dayStats(items: ActivityInstance[]): DayStats {
  const done = items.filter(i => i.status === 'done').length
  const skipped = items.filter(i => i.status === 'skipped').length
  const overdue = items.filter(i => i.status === 'overdue').length
  const moved = items.filter(i => i.status === 'moved').length
  const rescheduled = items.filter(i => i.rescheduled).length
  const eligible = items.length - moved
  return {
    total: items.length, eligible, done, skipped, overdue, moved, rescheduled,
    pct: eligible ? Math.round((done / eligible) * 100) : 0,
  }
}

/** The card that should be expanded: the active task, else the next upcoming one. */
export function focusInstance(items: ActivityInstance[]): ActivityInstance | undefined {
  return items.find(i => i.status === 'active') ?? items.find(i => i.status === 'upcoming')
}

export interface Conflict { a: { id: string; title: string; start: string; end?: string }; b: { id: string; title: string; start: string; end?: string } }

/** Detect overlapping time windows (point tasks count as instants). */
export function detectConflicts(blocks: { id: string; title: string; start: string; end?: string }[]): Conflict[] {
  const sorted = [...blocks].sort((x, y) => toMin(x.start) - toMin(y.start))
  const out: Conflict[] = []
  for (let i = 0; i < sorted.length; i++) {
    for (const hit of conflictsWith(sorted[i], sorted.slice(i + 1))) out.push({ a: sorted[i], b: hit })
  }
  return out
}

/** Check one candidate window against a list (used when editing/moving). */
export function conflictsWith(
  candidate: { id: string; start: string; end?: string },
  others: { id: string; title: string; start: string; end?: string }[],
) {
  const s = toMin(candidate.start), e = candidate.end ? toMin(candidate.end) : s
  return others.filter(o => {
    if (o.id === candidate.id) return false
    const os = toMin(o.start), oe = o.end ? toMin(o.end) : os
    if (s === e) return os <= s && s < oe
    if (os === oe) return s < os && os < e
    return os < e && s < oe
  })
}
