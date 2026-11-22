import { describe, expect, it } from 'vitest'
import { calorieAdvice, quarterOf, quarterRange, realReadiness, realisedR, revisionsDue, setupStats, weightTrend } from './insightsPlus'
import type { StudySubject, TradeJournalEntry } from './types'

const trade = (p: Partial<TradeJournalEntry>): TradeJournalEntry => ({ id: Math.random().toString(), date: '2026-11-01', kind: 'paper', instrument: 'NIFTYBEES', direction: 'Long', outcome: 'Open', screenshots: [], createdAt: 0, ...p })

describe('trading', () => {
  it('realised R uses exit price, else planned target / -1', () => {
    expect(realisedR(trade({ entry: 100, stopLoss: 98, exit: 104, outcome: 'Win' }))).toBe(2)
    expect(realisedR(trade({ entry: 100, stopLoss: 98, target: 103, outcome: 'Win' }))).toBe(1.5)
    expect(realisedR(trade({ entry: 100, stopLoss: 98, outcome: 'Loss' }))).toBe(-1)
    expect(realisedR(trade({ direction: 'Short', entry: 100, stopLoss: 102, exit: 97, outcome: 'Win' }))).toBe(1.5)
  })
  it('groups stats by setup', () => {
    const s = setupStats([trade({ setup: 'EMA pullback', entry: 100, stopLoss: 98, exit: 104, outcome: 'Win' }), trade({ setup: 'EMA pullback', entry: 100, stopLoss: 98, outcome: 'Loss' })])
    expect(s[0]).toMatchObject({ setup: 'EMA pullback', n: 2, winRate: 50, expectancy: 0.5 })
  })
  it('not ready for real money with few trades', () => {
    expect(realReadiness([trade({ entry: 1, stopLoss: 0.9, outcome: 'Win', target: 1.2 })]).ready).toBe(false)
  })
})

describe('spaced revision', () => {
  it('schedules revision 1 day after finishing, then 3, 7, 21', () => {
    const doneAt = new Date('2026-11-10T10:00:00').getTime()
    const subj = (revisedAt: number[]): StudySubject[] => [{ id: 's', name: 'Maths', chapters: [{ id: 'c', name: 'Algebra', done: true, revisions: revisedAt.length, doneAt, revisedAt }] }]
    expect(revisionsDue(subj([]), '2026-11-10')).toHaveLength(0)
    expect(revisionsDue(subj([]), '2026-11-11')[0]).toMatchObject({ round: 1, due: '2026-11-11' })
    const r1 = new Date('2026-11-11T09:00:00').getTime()
    expect(revisionsDue(subj([r1]), '2026-11-12')).toHaveLength(0)
    expect(revisionsDue(subj([r1]), '2026-11-13')[0]).toMatchObject({ round: 2, due: '2026-11-13' })
  })
})

describe('bulk tracker', () => {
  it('needs 3 weigh-ins over 10+ days', () => {
    expect(weightTrend([{ id: '1', date: '2026-11-20', kg: 65 }, { id: '2', date: '2026-11-21', kg: 65.1 }], 28, '2026-11-22')).toBeNull()
  })
  it('computes kg/week and advises calories', () => {
    const w = [{ id: '1', date: '2026-11-01', kg: 65 }, { id: '2', date: '2026-11-08', kg: 65.1 }, { id: '3', date: '2026-11-15', kg: 65.2 }]
    const t = weightTrend(w, 28, '2026-11-16')!
    expect(t.perWeek).toBeCloseTo(0.1, 2)
    expect(calorieAdvice(t.perWeek, 'lean-bulk')!.delta).toBe(150)
    expect(calorieAdvice(0.35, 'lean-bulk')!.delta).toBe(0)
    expect(calorieAdvice(0.9, 'bulk')!.delta).toBe(-150)
  })
})

describe('quarters', () => {
  it('maps dates to quarters and ranges', () => {
    expect(quarterOf('2026-11-22')).toBe('2026-Q4')
    expect(quarterRange('2026-Q4')).toEqual({ start: '2026-10-01', end: '2026-12-31' })
    expect(quarterRange('2026-Q1')).toEqual({ start: '2026-01-01', end: '2026-03-31' })
  })
})
