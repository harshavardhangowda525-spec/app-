import type { RecurrenceRule, Reminder } from './types'
import { addDays, addMonths, parseKey } from './time'

/** First occurrence on/after `from` that satisfies the rule, anchored at `start`. */
export function nextOccurrence(rule: RecurrenceRule, start: string, from: string): string {
  if (from < start) from = start
  switch (rule.type) {
    case 'daily':
      return from
    case 'everyNDays': {
      const n = Math.max(1, rule.n)
      const days = Math.round((parseKey(from).getTime() - parseKey(start).getTime()) / 86400000)
      const k = Math.ceil(days / n)
      return addDays(start, k * n)
    }
    case 'weekly': {
      const wds = rule.weekdays.length ? rule.weekdays : [parseKey(start).getDay()]
      for (let i = 0; i < 7; i++) {
        const d = addDays(from, i)
        if (wds.includes(parseKey(d).getDay())) return d
      }
      return from
    }
    case 'monthly': {
      let d = from
      for (let i = 0; i < 400; i++) {
        const dt = parseKey(d)
        const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
        if (dt.getDate() === Math.min(rule.day, last)) return d
        d = addDays(d, 1)
      }
      return from
    }
    case 'everyNMonths': {
      const n = Math.max(1, rule.n)
      let d = start
      for (let i = 0; i < 1000 && d < from; i++) d = addMonths(start, (i + 1) * n)
      return d
    }
  }
}

/** Due date after completing/skipping the occurrence on `due`. */
export function advance(rule: RecurrenceRule, start: string, due: string): string {
  return nextOccurrence(rule, start, addDays(due, 1))
}

/**
 * Interval reminders: "Every 3 days" counts from when the action actually happened (completion date),
 * so a late towel change resets the cycle. Calendar rules keep their fixed calendar anchor.
 */
export function afterAction(rem: Reminder, actionDate: string): string | null {
  if (!rem.startDate || !rem.nextDue) return null
  if (rem.rule.type === 'everyNDays') return addDays(actionDate > rem.nextDue ? actionDate : rem.nextDue, rem.rule.n)
  if (rem.rule.type === 'everyNMonths') return addMonths(actionDate > rem.nextDue ? actionDate : rem.nextDue, rem.rule.n)
  return advance(rem.rule, rem.startDate, rem.nextDue)
}

export function describeRule(rule: RecurrenceRule): string {
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  switch (rule.type) {
    case 'daily': return 'Every day'
    case 'everyNDays': return rule.n === 1 ? 'Every day' : `Every ${rule.n} days`
    case 'weekly': {
      const w = [...rule.weekdays].sort()
      if (w.join() === '1,2,3,4,5') return 'Weekdays'
      if (w.length === 7) return 'Every day'
      return `Weekly · ${w.map(x => WD[x]).join(', ')}`
    }
    case 'monthly': return `Monthly · day ${rule.day}`
    case 'everyNMonths': return rule.n === 6 ? 'Every 6 months' : `Every ${rule.n} months`
  }
}

/**
 * First due date when a reminder is activated.
 * `start` = the date the user says they last did it / anchors the cycle.
 * Interval rules (every N days/months) fall due N after the anchor; calendar rules use the next matching day from today.
 */
export function firstDue(rule: RecurrenceRule, start: string, today: string): string {
  if (rule.type === 'everyNDays' || rule.type === 'everyNMonths') {
    const after = addDays(start, 1)
    return nextOccurrence(rule, start, after > today ? after : today)
  }
  return nextOccurrence(rule, start, start > today ? start : today)
}
