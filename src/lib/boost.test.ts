import { describe, expect, it } from 'vitest'
import { allowed, BOOST_FOODS, dayCombos, dayGap, mealBoosts, toItem } from './boost'
import { bulkScore, sum, targets } from './health'
import type { FoodItem } from './types'

const t = targets({ goal: 'lean-bulk', sleepGoalMin: 450, weightKg: 65, heightCm: 175, age: 22, sex: 'male' })
const egg = { diet: 'egg' as const, whey: false, exclude: [] }
const dalRice: FoodItem[] = [{ name: 'Dal rice', kcal: 420, protein: 14, carbs: 72, fat: 8 }]

describe('bulk boost', () => {
  it('respects diet and whey preferences', () => {
    const ok = BOOST_FOODS.filter(f => allowed(f, egg))
    expect(ok.some(f => f.diet === 'nonveg')).toBe(false)
    expect(ok.some(f => f.whey)).toBe(false)
    expect(ok.some(f => f.id === 'eggs2')).toBe(true)
    expect(BOOST_FOODS.filter(f => allowed(f, { diet: 'veg', whey: false, exclude: [] })).some(f => f.diet === 'egg')).toBe(false)
  })
  it('suggests protein-first add-ons that lift a light meal to a good score', () => {
    const r = mealBoosts(dalRice, t, egg)
    expect(r.picks).toHaveLength(3)
    expect(r.picks.every(f => f.protein >= 5)).toBe(true)
    expect(bulkScore(sum(dalRice), t).score).toBeLessThan(8)
    expect(r.best!.score).toBeGreaterThanOrEqual(8)
    const boosted = [...dalRice, ...r.best!.foods.map(toItem)]
    expect(boosted.filter(i => i.boost).length).toBeGreaterThanOrEqual(1)
    expect(r.best!.foods.every(f => r.picks.includes(f))).toBe(true)
  })
  it('excluded foods never appear', () => {
    const r = mealBoosts(dalRice, t, { ...egg, exclude: BOOST_FOODS.filter(f => f.id.startsWith('egg') || f.id === 'paneer-bhurji').map(f => f.id) })
    expect(r.picks.some(f => f.id.startsWith('egg') || f.id === 'paneer-bhurji')).toBe(false)
  })
  it('ranks day combos and filters quick / budget', () => {
    const gap = dayGap({ kcal: t!.kcal - 760, protein: t!.protein - 32 }, t)!
    expect(gap.kcal).toBe(760)
    const best = dayCombos(gap, egg, 'best')
    expect(best.length).toBe(3)
    expect(best[0].tot.kcal).toBeGreaterThan(400)
    for (const c of dayCombos(gap, egg, 'quick')) expect(c.foods.every(f => f.quick)).toBe(true)
    for (const c of dayCombos(gap, egg, 'budget')) expect(c.foods.every(f => f.budget)).toBe(true)
    expect(dayCombos(gap, egg, 'best', 20).some(c => c.foods.some(f => f.diet === 'nonveg' || f.whey))).toBe(false)
  })
  it('no gap when on target', () => {
    expect(dayGap({ kcal: t!.kcal, protein: t!.protein }, t)).toBeNull()
  })
})
