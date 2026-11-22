import { describe, expect, it } from 'vitest'
import { bulkScore, detectSleep, sleepScore, targets } from './health'

describe('nutrition targets', () => {
  it('needs real body stats — never invents targets', () => {
    expect(targets({ goal: 'lean-bulk', sleepGoalMin: 450 })).toBeNull()
  })
  it('lean bulk for a 65 kg, 175 cm, 20 y male', () => {
    const t = targets({ goal: 'lean-bulk', sleepGoalMin: 450, weightKg: 65, heightCm: 175, age: 20, sex: 'male' })!
    // BMR = 650 + 1093.75 - 100 + 5 = 1648.75 → ×1.55 = 2555.6 → +300 = 2855.6 → 2860
    expect(t.kcal).toBe(2860)
    expect(t.protein).toBe(124) // 1.9 g/kg
    expect(t.fat).toBe(Math.round((2860 * 0.25) / 9))
    expect(t.carbs * 4 + t.protein * 4 + t.fat * 9).toBeLessThanOrEqual(2860 + 4)
  })
})

describe('bulk score', () => {
  const t = { kcal: 2800, protein: 140, carbs: 380, fat: 78 }
  it('rewards a high-protein, calorie-dense meal', () => {
    const b = bulkScore({ kcal: 780, protein: 42, carbs: 96, fat: 24 }, t)
    expect(b.score).toBeGreaterThanOrEqual(8)
    expect(b.verdict).toBe('Great for muscle gain')
  })
  it('flags a light, low-protein snack with a concrete tip', () => {
    const b = bulkScore({ kcal: 180, protein: 3, carbs: 30, fat: 6 }, t)
    expect(b.score).toBeLessThan(4)
    expect(b.tip).toMatch(/protein/)
  })
})

describe('sleep from screen activity', () => {
  const H = 3600e3, M = 60e3
  const night = new Date('2026-11-21T21:30:00+05:30').getTime()
  const end = night + 14.5 * H // noon
  it('finds the main sleep block and counts a short pick-up as a wake-up', () => {
    const ev = [
      { ts: night, type: 'on' as const },
      { ts: night + 78 * M, type: 'off' as const },                 // 10:48 PM phone down
      { ts: night + 78 * M + 3.5 * H, type: 'on' as const },        // 2:18 AM quick check
      { ts: night + 78 * M + 3.5 * H + 4 * M, type: 'off' as const },
      { ts: night + 8.5 * H, type: 'on' as const },                 // 6:00 AM wake
    ]
    const d = detectSleep(ev, night, end)!
    expect(new Date(d.sleepStart).toISOString()).toBe(new Date(night + 78 * M).toISOString())
    expect(new Date(d.wake).toISOString()).toBe(new Date(night + 8.5 * H).toISOString())
    expect(d.wakeUps).toBe(1)
    expect(d.asleepMin).toBe(7 * 60 + 12 - 4) // 7h12m window minus the 4-min pick-up
  })
  it('returns null when there is no real sleep block', () => {
    expect(detectSleep([{ ts: night, type: 'on' }], night, end, true)).toBeNull()
  })
  it('scores a good night highly and a short late night lower', () => {
    const good = sleepScore({ asleepMin: 450, wakeUps: 0, sleepStart: new Date('2026-11-21T22:45:00+05:30').getTime(), rested: 4 })
    const bad = sleepScore({ asleepMin: 270, wakeUps: 3, sleepStart: new Date('2026-11-22T01:30:00+05:30').getTime(), rested: 2 })
    expect(good).toBeGreaterThanOrEqual(85)
    expect(bad).toBeLessThan(50)
  })
})
