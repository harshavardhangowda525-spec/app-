import { bulkScore, sum, type Targets } from './health'
import type { DietType, FoodItem, HealthProfile } from './types'

/**
 * Bulk Boost — offline add-on suggestions. A fixed list of gym-friendly Indian foods
 * with standard portions; Kairo ranks them to close the protein gap first, then calories.
 */
export interface BoostFood {
  id: string; emoji: string; name: string; grams?: number
  kcal: number; protein: number; carbs: number; fat: number
  diet: DietType // lowest diet that can eat it: veg ⊂ egg ⊂ nonveg
  whey?: boolean; quick?: boolean; budget?: boolean
}

const F = (id: string, emoji: string, name: string, kcal: number, protein: number, carbs: number, fat: number, o: Partial<BoostFood> = {}): BoostFood =>
  ({ id, emoji, name, kcal, protein, carbs, fat, diet: 'veg', ...o })

export const BOOST_FOODS: BoostFood[] = [
  F('milk', '🥛', 'Glass of milk (300 ml)', 190, 10, 14, 10, { grams: 300, quick: true, budget: true }),
  F('curd', '🥣', 'Curd bowl (150 g)', 95, 5, 7, 5, { grams: 150, quick: true, budget: true }),
  F('hung-curd', '🥣', 'Hung curd (150 g)', 150, 12, 6, 8, { grams: 150, quick: true }),
  F('lassi', '🥤', 'Sweet lassi (300 ml)', 250, 8, 40, 6, { grams: 300, quick: true }),
  F('paneer', '🧀', 'Paneer (100 g)', 265, 18, 4, 20, { grams: 100 }),
  F('paneer-bhurji', '🧀', 'Paneer bhurji (150 g)', 360, 24, 8, 26, { grams: 150 }),
  F('soya', '🫘', 'Soya chunks (50 g dry)', 172, 26, 16, 1, { grams: 50, budget: true }),
  F('tofu', '⬜', 'Tofu (100 g)', 145, 15, 3, 8, { grams: 100 }),
  F('cheese', '🧀', '2 cheese slices', 130, 8, 2, 10, { grams: 40, quick: true }),
  F('pb', '🥜', 'Peanut butter (2 tbsp)', 190, 8, 6, 16, { grams: 32, quick: true }),
  F('peanuts', '🥜', 'Roasted peanuts (30 g)', 170, 7, 5, 14, { grams: 30, quick: true, budget: true }),
  F('almonds', '🌰', 'Almonds (25 g)', 145, 5, 5, 12, { grams: 25, quick: true }),
  F('trail', '🌰', 'Nuts & raisins mix (40 g)', 200, 6, 16, 13, { grams: 40, quick: true }),
  F('chikki', '🍬', 'Peanut chikki (30 g)', 150, 4, 18, 7, { grams: 30, quick: true, budget: true }),
  F('banana', '🍌', 'Banana', 105, 1, 27, 0, { grams: 118, quick: true, budget: true }),
  F('dates', '🌴', '4 dates', 95, 1, 24, 0, { grams: 32, quick: true, budget: true }),
  F('raisins', '🍇', 'Raisins (30 g)', 90, 1, 24, 0, { grams: 30, quick: true, budget: true }),
  F('oats', '🥣', 'Oats (50 g)', 190, 7, 33, 4, { grams: 50, budget: true }),
  F('bread', '🍞', '2 slices brown bread', 140, 6, 24, 2, { grams: 56, quick: true, budget: true }),
  F('roti', '🫓', '2 rotis', 240, 6, 40, 6, { grams: 80, budget: true }),
  F('rice', '🍚', 'Rice (1 cup)', 195, 4, 42, 1, { grams: 150, budget: true }),
  F('ghee', '🧈', 'Ghee (1 tbsp)', 112, 0, 0, 13, { grams: 13, budget: true }),
  F('dal', '🍲', 'Dal (1 bowl)', 170, 9, 25, 3, { grams: 150, budget: true }),
  F('chana', '🫘', 'Chana / chickpeas (1 bowl)', 210, 11, 35, 4, { grams: 150, budget: true }),
  F('rajma', '🫘', 'Rajma (1 bowl)', 200, 12, 34, 1, { grams: 150, budget: true }),
  F('sprouts', '🌱', 'Moong sprouts chaat (150 g)', 120, 9, 20, 1, { grams: 150, budget: true }),
  F('poha', '🍛', 'Poha plate', 250, 5, 45, 6, { grams: 200, budget: true }),
  F('sweet-potato', '🍠', 'Sweet potato (150 g)', 130, 2, 30, 0, { grams: 150, budget: true }),
  F('makhana', '🍿', 'Roasted makhana (30 g)', 105, 3, 23, 0, { grams: 30, quick: true }),
  F('whey', '🥤', 'Whey scoop (water)', 120, 24, 3, 2, { grams: 30, whey: true, quick: true }),
  F('eggs2', '🥚', '2 boiled eggs', 156, 13, 1, 11, { diet: 'egg', grams: 100, budget: true }),
  F('eggs4', '🥚', '4 boiled eggs', 312, 26, 2, 22, { diet: 'egg', grams: 200, budget: true }),
  F('whites', '🥚', '4 egg whites', 68, 14, 1, 0, { diet: 'egg', grams: 132, budget: true }),
  F('omelette', '🍳', '3-egg omelette', 280, 19, 2, 22, { diet: 'egg', grams: 160, budget: true }),
  F('bhurji', '🍳', 'Egg bhurji (2 eggs)', 200, 13, 3, 15, { diet: 'egg', grams: 120, budget: true }),
  F('chicken', '🍗', 'Chicken breast (100 g)', 165, 31, 0, 4, { diet: 'nonveg', grams: 100 }),
  F('chicken-curry', '🍛', 'Chicken curry (1 bowl)', 250, 22, 6, 15, { diet: 'nonveg', grams: 200 }),
  F('fish', '🐟', 'Fish (100 g)', 150, 22, 0, 6, { diet: 'nonveg', grams: 100 }),
  F('mutton', '🍖', 'Mutton (100 g)', 250, 25, 0, 16, { diet: 'nonveg', grams: 100 }),
]
export const foodById = (id: string) => BOOST_FOODS.find(f => f.id === id)

export interface BoostPrefs { diet: DietType; whey: boolean; exclude: string[] }
export const boostPrefs = (p: HealthProfile): BoostPrefs => ({ diet: p.diet ?? 'egg', whey: p.whey ?? false, exclude: p.excludeFoods ?? [] })

const RANK: Record<DietType, number> = { veg: 0, egg: 1, nonveg: 2 }
export const allowed = (f: BoostFood, p: BoostPrefs) => RANK[f.diet] <= RANK[p.diet] && (!f.whey || p.whey) && !p.exclude.includes(f.id)

export const toItem = (f: BoostFood): FoodItem => ({ name: f.name, grams: f.grams, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, boost: f.id })

/** Per-meal gap vs ¼ of the daily target (same split as the bulk score). */
export function mealGap(m: { kcal: number; protein: number }, t: Targets | null) {
  const perKcal = (t?.kcal ?? 2800) / 4, perProtein = (t?.protein ?? 130) / 4
  return { kcal: Math.max(0, Math.round(perKcal - m.kcal)), protein: Math.max(0, Math.round(perProtein - m.protein)) }
}

/** How well a food closes a gap: protein first (60%), then calories (40%), overshoot lightly penalised. */
function fit(f: { kcal: number; protein: number }, gap: { kcal: number; protein: number }) {
  const p = gap.protein > 0 ? Math.min(f.protein, gap.protein) / gap.protein : 0
  const k = gap.kcal > 0 ? Math.min(f.kcal, gap.kcal) / gap.kcal : 0
  const over = gap.kcal > 0 ? Math.max(0, f.kcal - gap.kcal * 1.3) / gap.kcal : 0
  return p * 0.6 + k * 0.4 - over * 0.3
}

/**
 * Top add-ons for a meal (base = the meal without any boost items) plus the best
 * 2-item pair to suggest as a one-line hint. Foods already in the meal by name are skipped.
 */
export function mealBoosts(base: FoodItem[], t: Targets | null, prefs: BoostPrefs, n = 3) {
  const tot = sum(base)
  const gap = mealGap(tot, t)
  const names = base.map(i => i.name.toLowerCase())
  const pool = BOOST_FOODS.filter(f => allowed(f, prefs) && !names.some(nm => nm && nm.includes(f.name.toLowerCase().split(' (')[0])))
  const ranked = pool.map(f => ({ f, s: fit(f, gap) })).sort((a, b) => b.s - a.s)
  // Variety: no more than one food per "family" (eggs, paneer, curd) in the top picks.
  const fam = (id: string) => id.replace(/\d+$/, '').split('-')[0].replace('whites', 'eggs').replace('omelette', 'eggs').replace('bhurji', 'eggs').replace('hung', 'curd')
  const picks: BoostFood[] = []
  for (const r of ranked) { if (picks.length >= n) break; if (!picks.some(p => fam(p.id) === fam(r.f.id))) picks.push(r.f) }
  let best: { foods: BoostFood[]; tot: ReturnType<typeof sum>; score: number } | null = null
  // The hint only ever names chips that are on screen: best single or pair from the picks.
  const combos: BoostFood[][] = [...picks.map(f => [f]), ...picks.flatMap((f, i) => picks.slice(i + 1).map(g => [f, g]))]
  for (const fs of combos) {
    const nt = sum([tot, ...fs])
    const sc = bulkScore(nt, t).score
    // highest score wins; among scores ≥ 8, fewer items then fewer extra kcal
    const better = !best || (Math.min(sc, 8) > Math.min(best.score, 8)) ||
      (Math.min(sc, 8) === Math.min(best.score, 8) && (fs.length < best.foods.length || (fs.length === best.foods.length && sc > best.score)))
    if (better) best = { foods: fs, tot: nt, score: sc }
  }
  return { gap, picks, best }
}

/** Show the boost card when the meal is light for a bulk. */
export const needsBoost = (score: number) => score < 8

// ---------- Close today's gap: whole-snack combos ----------
export interface Combo { id: string; title: string; detail: string; foods: string[] }
export const COMBOS: Combo[] = [
  { id: 'shake-pb', title: '🥛 Banana milkshake + 🥜 PB toast', detail: 'Milk 300 ml + banana + 2 tbsp PB on toast', foods: ['milk', 'banana', 'pb', 'bread'] },
  { id: 'paneer-roti', title: '🧀 Paneer bhurji + 2 rotis', detail: 'Paneer bhurji 150 g with 2 rotis', foods: ['paneer-bhurji', 'roti'] },
  { id: 'eggs-rice', title: '🥚 4 eggs + 🍚 rice + ghee', detail: '4 boiled eggs, 1 cup rice, 1 tbsp ghee', foods: ['eggs4', 'rice', 'ghee'] },
  { id: 'omelette-toast', title: '🍳 Omelette + toast + milk', detail: '3-egg omelette, 2 slices bread, 300 ml milk', foods: ['omelette', 'bread', 'milk'] },
  { id: 'soya-rice', title: '🫘 Soya chunks + rice + curd', detail: 'Soya 50 g, 1 cup rice, curd bowl', foods: ['soya', 'rice', 'curd'] },
  { id: 'dal-roti-curd', title: '🍲 Dal + 2 rotis + curd', detail: 'Dal bowl, 2 rotis, curd bowl', foods: ['dal', 'roti', 'curd'] },
  { id: 'chana-roti', title: '🫘 Chana + 2 rotis + ghee', detail: 'Chana bowl, 2 rotis, 1 tbsp ghee', foods: ['chana', 'roti', 'ghee'] },
  { id: 'oats-milk', title: '🥣 Oats + milk + banana + nuts', detail: 'Oats 50 g in 300 ml milk, banana, almonds', foods: ['oats', 'milk', 'banana', 'almonds'] },
  { id: 'curd-nuts', title: '🥣 Hung curd + nuts + dates', detail: 'Hung curd 150 g, nut mix, 4 dates', foods: ['hung-curd', 'trail', 'dates'] },
  { id: 'lassi-peanuts', title: '🥤 Lassi + peanuts + banana', detail: 'Sweet lassi, roasted peanuts, banana', foods: ['lassi', 'peanuts', 'banana'] },
  { id: 'milk-chikki', title: '🥛 Milk + chikki + dates', detail: '300 ml milk, peanut chikki, 4 dates', foods: ['milk', 'chikki', 'dates'] },
  { id: 'bhurji-roti', title: '🍳 Egg bhurji + 2 rotis + milk', detail: 'Bhurji (2 eggs), 2 rotis, 300 ml milk', foods: ['bhurji', 'roti', 'milk'] },
  { id: 'sprouts-paneer', title: '🌱 Sprouts chaat + paneer', detail: 'Moong sprouts 150 g with 100 g paneer', foods: ['sprouts', 'paneer'] },
  { id: 'rajma-rice', title: '🫘 Rajma chawal + curd', detail: 'Rajma bowl, 1 cup rice, curd bowl', foods: ['rajma', 'rice', 'curd'] },
  { id: 'whey-milk', title: '🥤 Whey in milk + banana + PB', detail: 'Whey scoop in 300 ml milk, banana, 2 tbsp PB', foods: ['whey', 'milk', 'banana', 'pb'] },
  { id: 'chicken-rice', title: '🍗 Chicken + rice + curd', detail: 'Chicken breast 100 g, 1 cup rice, curd', foods: ['chicken', 'rice', 'curd'] },
  { id: 'chicken-curry-roti', title: '🍛 Chicken curry + 2 rotis', detail: 'Chicken curry bowl with 2 rotis', foods: ['chicken-curry', 'roti'] },
  { id: 'fish-rice', title: '🐟 Fish + rice + dal', detail: 'Fish 100 g, 1 cup rice, dal bowl', foods: ['fish', 'rice', 'dal'] },
]

export type ComboMode = 'best' | 'quick' | 'budget'
export function comboFoods(c: Combo) { return c.foods.map(foodById).filter((f): f is BoostFood => !!f) }

/** Rank snack combos that fit your diet against today's remaining gap. */
export function dayCombos(gap: { kcal: number; protein: number }, prefs: BoostPrefs, mode: ComboMode, n = 3) {
  return COMBOS
    .map(c => ({ c, foods: comboFoods(c) }))
    .filter(x => x.foods.length === x.c.foods.length && x.foods.every(f => allowed(f, prefs)))
    .filter(x => mode === 'best' || x.foods.every(f => (mode === 'quick' ? f.quick : f.budget)))
    .map(x => { const tot = sum(x.foods); return { ...x, tot, s: fit(tot, gap) } })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
}

/** Today's remaining gap, or null when on target. */
export function dayGap(tot: { kcal: number; protein: number }, t: Targets | null) {
  if (!t) return null
  const kcal = Math.max(0, Math.round(t.kcal - tot.kcal)), protein = Math.max(0, Math.round(t.protein - tot.protein))
  return kcal >= 150 || protein >= 10 ? { kcal, protein } : null
}
