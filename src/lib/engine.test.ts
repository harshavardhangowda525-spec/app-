import { describe, expect, it } from 'vitest'
import { WEEKDAY_BLOCKS, defaultTemplates } from '../data/defaults'
import { buildDay, conflictsWith, dayStats, detectConflicts, focusInstance, templateFor } from './schedule'
import { advance, afterAction, firstDue, nextOccurrence } from './recurrence'
import { addMonths, toMin } from './time'
import type { ActivityCompletion, Reminder } from './types'

const tpl = defaultTemplates()[0]
const DAY = '2026-11-23' // Monday
const day = (nowHHMM: string, completions: Record<string, ActivityCompletion> = {}, graceMin = 0) =>
  buildDay({ date: DAY, today: DAY, nowMinutes: toMin(nowHHMM), template: tpl, overrides: [], extras: [], completions, graceMin })

describe('timetable', () => {
  it('has the 20 activities from 5:00 AM to 9:30 PM (incl. Assignments)', () => {
    expect(WEEKDAY_BLOCKS).toHaveLength(20)
    expect(WEEKDAY_BLOCKS.find(b => b.id === 'assignments')).toMatchObject({ start: '18:15', end: '19:15' })
    expect(WEEKDAY_BLOCKS[0]).toMatchObject({ start: '05:00', title: 'Wake up and hydrate' })
    expect(WEEKDAY_BLOCKS.at(-1)).toMatchObject({ start: '21:30', title: 'Sleep' })
  })
  it('has exactly one 60-minute study block, followed by trading practice', () => {
    const study = WEEKDAY_BLOCKS.filter(b => b.module === 'study')
    expect(study).toHaveLength(1)
    expect(toMin(study[0].end!) - toMin(study[0].start)).toBe(60)
    expect(WEEKDAY_BLOCKS.find(b => b.start === study[0].end)?.id).toBe('trade-practice')
  })
  it('keeps 2h deep dev, 1h research, 3 manifestations, separate recording/editing', () => {
    const dev = WEEKDAY_BLOCKS.find(b => b.id === 'dev')!
    expect(toMin(dev.end!) - toMin(dev.start)).toBe(120)
    const r = WEEKDAY_BLOCKS.find(b => b.id === 'research')!
    expect(toMin(r.end!) - toMin(r.start)).toBe(60)
    expect(WEEKDAY_BLOCKS.filter(b => b.category === 'Mindset').map(b => b.start)).toEqual(['06:00', '18:00', '21:15'])
    expect(WEEKDAY_BLOCKS.find(b => b.id === 'record')!.end).toBe(WEEKDAY_BLOCKS.find(b => b.id === 'edit')!.start)
  })
  it('default timetable has no conflicts', () => {
    expect(detectConflicts(WEEKDAY_BLOCKS)).toEqual([])
  })
})

describe('live schedule engine', () => {
  it('identifies the current activity by device time', () => {
    const items = day('10:03')
    expect(items.find(i => i.status === 'active')?.id).toBe('dev')
    expect(focusInstance(items)?.id).toBe('dev')
  })
  it('never auto-completes: past unmarked tasks become overdue, not done', () => {
    const items = day('10:03')
    expect(items.find(i => i.id === 'gym')?.status).toBe('overdue')
    expect(items.filter(i => i.status === 'done')).toHaveLength(0)
  })
  it('suggests the next activity during free time', () => {
    const items = day('08:55')
    expect(items.find(i => i.status === 'active')).toBeUndefined()
    expect(focusInstance(items)?.id).toBe('dev')
  })
  it('completion % = done / eligible; skipped never counts as completed', () => {
    const c = (id: string, status: ActivityCompletion['status']): ActivityCompletion =>
      ({ id: `${DAY}:${id}`, date: DAY, blockId: id, title: id, category: 'Personal', status, at: 0, scheduledStart: '05:00' })
    const items = day('12:00', { [`${DAY}:wake`]: c('wake', 'done'), [`${DAY}:read-am`]: c('read-am', 'skipped'), [`${DAY}:gym`]: c('gym', 'moved') })
    const s = dayStats(items)
    expect(s.done).toBe(1)
    expect(s.skipped).toBe(1)
    expect(s.eligible).toBe(19) // moved item excluded
    expect(s.pct).toBe(Math.round((1 / 19) * 100))
  })
  it('per-day overrides reschedule without touching the template', () => {
    const items = buildDay({ date: DAY, today: DAY, nowMinutes: toMin('09:00'), template: tpl, overrides: [{ id: 'o', date: DAY, blockId: 'research', start: '17:45', end: '18:45', createdAt: 0 }], extras: [], completions: {} })
    expect(items.find(i => i.id === 'research')).toMatchObject({ start: '17:45', rescheduled: true })
    expect(tpl.blocks.find(b => b.id === 'research')!.start).toBe('11:30')
  })
  it('detects overlaps instead of overwriting', () => {
    const hits = conflictsWith({ id: 'x', start: '09:30', end: '10:00' }, WEEKDAY_BLOCKS)
    expect(hits.map(h => h.id)).toEqual(['dev'])
    expect(conflictsWith({ id: 'x', start: '08:45', end: '09:15' }, WEEKDAY_BLOCKS)).toEqual([])
  })
  it('uses weekend template on weekend days', () => {
    expect(templateFor('2026-11-22', defaultTemplates(), [0, 6]).kind).toBe('weekend')
    expect(templateFor(DAY, defaultTemplates(), [0, 6]).kind).toBe('weekday')
  })
})

describe('recurrence engine', () => {
  const rem = (rule: Reminder['rule'], startDate: string, nextDue: string): Reminder =>
    ({ id: 'r', title: 't', rule, time: '09:00', startDate, nextDue, active: true, notify: true, history: [], createdAt: 0 })
  it('every 3 days from a start date', () => {
    expect(nextOccurrence({ type: 'everyNDays', n: 3 }, '2026-11-01', '2026-11-05')).toBe('2026-11-07')
    expect(advance({ type: 'everyNDays', n: 3 }, '2026-11-01', '2026-11-04')).toBe('2026-11-07')
  })
  it('first due for interval reminders is N days after the date last done', () => {
    expect(firstDue({ type: 'everyNDays', n: 3 }, '2026-11-21', '2026-11-21')).toBe('2026-11-24')
    expect(firstDue({ type: 'everyNDays', n: 3 }, '2026-11-10', '2026-11-21')).toBe('2026-11-22')
  })
  it('late completion resets an interval cycle from the completion date', () => {
    expect(afterAction(rem({ type: 'everyNDays', n: 3 }, '2026-11-01', '2026-11-04'), '2026-11-06')).toBe('2026-11-09')
  })
  it('weekly on chosen weekdays', () => {
    expect(nextOccurrence({ type: 'weekly', weekdays: [0] }, '2026-11-01', '2026-11-23')).toBe('2026-11-29')
  })
  it('every six months, clamping month ends', () => {
    expect(firstDue({ type: 'everyNMonths', n: 6 }, '2026-08-31', '2026-11-21')).toBe('2027-02-28')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })
  it('monthly on a day', () => {
    expect(nextOccurrence({ type: 'monthly', day: 31 }, '2026-01-01', '2026-02-10')).toBe('2026-02-28')
  })
})
