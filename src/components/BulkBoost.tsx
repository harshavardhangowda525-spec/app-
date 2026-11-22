import { AnimatePresence, motion } from 'framer-motion'
import { Check, Plus, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Field, Pill, Sheet } from './ui'
import { BOOST_FOODS, boostPrefs, dayCombos, foodById, mealBoosts, mealGap, needsBoost, toItem, type ComboMode } from '../lib/boost'
import { bulkScore, sum, type Targets } from '../lib/health'
import { dateKey, uid } from '../lib/time'
import type { DietType, FoodItem } from '../lib/types'
import { useStore } from '../store/useStore'

const short = (n: string) => n.replace(/\s*\(.*\)/, '').replace(/^\d+[-\s]?/, '').toLowerCase()

/** "⚡ Boost for bulk" card on the meal result sheet. Tapping a chip adds/removes it as an item. */
export function BoostCard({ items, setItems, t }: { items: FoodItem[]; setItems: (f: (xs: FoodItem[]) => FoodItem[]) => void; t: Targets | null }) {
  const profile = useStore(s => s.healthProfile)
  const prefs = boostPrefs(profile)
  const base = items.filter(i => !i.boost)
  const baseTot = sum(base)
  const boosted = items.filter(i => i.boost)
  const key = `${Math.round(baseTot.kcal)}-${Math.round(baseTot.protein)}-${base.map(b => b.name).join('|')}-${prefs.diet}-${prefs.whey}-${prefs.exclude.join(',')}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sug = useMemo(() => mealBoosts(base, t, prefs), [key, t])
  const baseScore = bulkScore(baseTot, t).score
  const nowScore = bulkScore(sum(items), t).score
  if (baseTot.kcal <= 0 || (!needsBoost(baseScore) && !boosted.length)) return null

  const chips = [...sug.picks]
  for (const b of boosted) { const f = foodById(b.boost!); if (f && !chips.some(c => c.id === f.id)) chips.push(f) }
  const on = (id: string) => boosted.some(b => b.boost === id)
  const toggle = (id: string) => {
    const f = foodById(id); if (!f) return
    navigator.vibrate?.(15)
    setItems(xs => (xs.some(x => x.boost === id) ? xs.filter(x => x.boost !== id) : [...xs, toItem(f)]))
  }
  const closed = nowScore >= 8
  const gapNow = mealGap(sum(items), t)
  const pct = sug.gap.protein + sug.gap.kcal > 0
    ? Math.min(1, 1 - (gapNow.protein / Math.max(1, sug.gap.protein) * 0.6 + gapNow.kcal / Math.max(1, sug.gap.kcal) * 0.4))
    : 1

  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.7 }}
      className="relative overflow-hidden rounded-[20px] p-3 border border-lavender/25" style={{ background: 'linear-gradient(150deg,#2b2140,#17122a)' }}>
      <motion.div aria-hidden className="absolute -inset-[40%] pointer-events-none" style={{ background: 'conic-gradient(from 0deg,transparent,#c9b8ff22,transparent 30%)' }}
        animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 6, ease: 'linear' }} />
      <div className="relative">
        <div className="flex justify-between items-center">
          <b className="text-[13px] text-lavender flex items-center gap-1"><Zap size={14} fill="currentColor" /> Boost for bulk</b>
          <AnimatePresence mode="popLayout">
            {closed
              ? <motion.span key="c" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[10px] font-extrabold text-success">GAP CLOSED ✓</motion.span>
              : <motion.span key="t" className="text-[10px] font-bold text-ink-2">tap to add</motion.span>}
          </AnimatePresence>
        </div>
        {boosted.length
          ? <div className="h-[7px] rounded-full bg-white/8 overflow-hidden mt-2 mb-1"><motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#FFC4AE,#9BE7C4)' }} animate={{ width: `${Math.max(8, pct * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
          : <div className="text-[10.5px] text-ink-2 mt-0.5">Short by ~{sug.gap.kcal} kcal and ~{sug.gap.protein} g protein for this meal — protein first</div>}
        <div className="flex flex-col gap-1.5 mt-2">
          {chips.map((f, i) => {
            const sel = on(f.id)
            return (
              <motion.button key={f.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.85 + i * 0.08 }} whileTap={{ scale: 0.97 }} onClick={() => toggle(f.id)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[14px] border text-left transition-colors ${sel ? 'bg-success/8 border-success/40' : 'bg-white/[.04] border-white/8'}`}>
                <span className="text-xl w-7 text-center">{f.emoji}</span>
                <div className="min-w-0 flex-1"><b className="text-[12.5px] block truncate">{f.name}</b><span className="text-[10px] text-ink-2 font-semibold">+{f.kcal} kcal · +{f.protein} g protein</span></div>
                <motion.span key={sel ? 'y' : 'n'} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className={`size-[30px] shrink-0 rounded-full grid place-items-center ${sel ? 'bg-success text-[#0a2a1c]' : 'bg-lavender/15 text-lavender'}`}>
                  {sel ? <Check size={15} strokeWidth={3} /> : <Plus size={15} strokeWidth={3} />}
                </motion.span>
              </motion.button>
            )
          })}
        </div>
        {!boosted.length && sug.best && (
          <button onClick={() => { navigator.vibrate?.(20); setItems(xs => [...xs, ...sug.best!.foods.filter(f => !xs.some(x => x.boost === f.id)).map(toItem)]) }}
            className="text-[10.5px] text-success mt-2 font-bold text-left">
            Add {sug.best.foods.map(f => short(f.name)).join(' + ')} → {Math.round(sug.best.tot.kcal)} kcal · {Math.round(sug.best.tot.protein)} g protein · score {sug.best.score.toFixed(1)}
          </button>
        )}
        {boosted.length > 0 && !closed && <div className="text-[10.5px] text-ink-2 mt-2">Still ~{gapNow.kcal} kcal · {gapNow.protein} g protein short — add one more.</div>}
      </div>
    </motion.div>
  )
}

/** Header kcal with the original struck through and a "+N" fly-up when add-ons are on. */
export function BoostedKcal({ items, conf }: { items: FoodItem[]; conf?: string }) {
  const tot = Math.round(sum(items).kcal)
  const base = Math.round(sum(items.filter(i => !i.boost)).kcal)
  const added = tot - base
  return (
    <div className="text-right shrink-0 relative">
      <AnimatePresence>{added > 0 && <motion.span key={added} className="absolute right-0 -top-4 text-xs font-extrabold text-success" initial={{ y: 0, opacity: 0 }} animate={{ y: -18, opacity: [0, 1, 0] }} transition={{ duration: 1.4 }}>+{added}</motion.span>}</AnimatePresence>
      <div className="flex items-baseline justify-end gap-1.5">
        {added > 0 && <span className="text-[13px] text-ink-3 line-through font-bold">{base}</span>}
        <motion.b key={tot} initial={{ scale: 1.2, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className="text-[28px] font-extrabold tracking-tight text-peach leading-none">{tot}</motion.b>
      </div>
      <div className="text-[10px] text-ink-2 font-bold">KCAL{conf ? ' (±10%)' : ''}</div>
    </div>
  )
}

/** "Close today's gap" sheet — whole-snack combos ranked against what's left today. */
export function GapSheet({ open, onClose, gap, onTweak }: { open: boolean; onClose: () => void; gap: { kcal: number; protein: number } | null; onTweak: (title: string, items: FoodItem[]) => void }) {
  const profile = useStore(s => s.healthProfile)
  const save = useStore(s => s.save)
  const [mode, setMode] = useState<ComboMode>('best')
  const prefs = boostPrefs(profile)
  const list = gap ? dayCombos(gap, prefs, mode) : []
  const logSnack = (title: string, items: FoodItem[]) => {
    const tot = sum(items)
    save('meals', { id: uid(), date: dateKey(), at: Date.now(), title, items, ...tot, source: 'manual' })
    navigator.vibrate?.([20, 40, 20]); onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Close today's gap">
      {gap ? (
        <div className="space-y-2.5">
          <div className="text-xs text-ink-2 -mt-1">{gap.kcal.toLocaleString("en-IN")} kcal · {gap.protein} g protein left today</div>
          <div className="flex gap-1.5">
            {([['best', 'Best match'], ['quick', 'Quick (no cook)'], ['budget', 'Budget']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`flex-1 h-8 rounded-full text-[11px] font-extrabold ${mode === v ? 'bg-white text-on-peach' : 'bg-white/[.05] text-ink-2'}`}>{l}</button>
            ))}
          </div>
          {list.length === 0 && <div className="text-sm text-ink-3 py-4 text-center">No combos match your diet settings for this filter.</div>}
          {list.map((x, i) => {
            const items = x.foods.map(toItem)
            const title = x.c.title.replace(/[^\p{L}\p{N}+&\s-]/gu, '').replace(/\s+/g, ' ').trim()
            const cover = Math.min(100, Math.round((Math.min(1, x.tot.protein / Math.max(1, gap.protein)) * 0.6 + Math.min(1, x.tot.kcal / Math.max(1, gap.kcal)) * 0.4) * 100))
            return (
              <motion.div key={`${mode}-${x.c.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className={`rounded-[20px] p-3 border ${i === 0 ? 'border-success/35' : 'border-white/8 bg-white/[.03]'}`}
                style={i === 0 ? { background: 'linear-gradient(150deg,#9be7c41a,#9be7c405)' } : undefined}>
                <div className="flex justify-between items-start gap-2">
                  <b className="text-[13px]">{x.c.title}</b>
                  {i === 0 ? <span className="text-[10px] font-extrabold text-success shrink-0">BEST</span>
                    : <span className="text-[10px] text-ink-2 font-bold shrink-0">+{Math.round(x.tot.kcal)} kcal · +{Math.round(x.tot.protein)} g P</span>}
                </div>
                <div className="text-[11.5px] text-ink-2 mt-0.5">{x.c.detail}</div>
                {i === 0 && (
                  <>
                    <div className="flex justify-between text-xs mt-1.5"><span className="text-ink-2">Total</span><b>+{Math.round(x.tot.kcal)} kcal · +{Math.round(x.tot.protein)} g protein</b></div>
                    <div className="h-[7px] rounded-full bg-white/8 overflow-hidden my-1.5"><motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#FFC4AE,#9BE7C4)' }} initial={{ width: 0 }} animate={{ width: `${cover}%` }} transition={{ duration: 1.1, delay: 0.2 }} /></div>
                  </>
                )}
                <div className="flex gap-1.5 mt-2">
                  <Pill variant={i === 0 ? 'white' : undefined} className="flex-1 h-9 text-xs" onClick={() => logSnack(title, items)}>Log as snack</Pill>
                  <Pill className="h-9 text-xs px-4" onClick={() => { onClose(); onTweak(title, items) }}>Tweak</Pill>
                </div>
              </motion.div>
            )
          })}
          <div className="text-[10px] text-ink-3 text-center">Based on your diet preference ({DIET_LABEL[prefs.diet]}{prefs.whey ? ', whey OK' : ', no whey'}) · standard portions</div>
        </div>
      ) : <div className="text-sm text-success py-6 text-center">You're on target today ✓</div>}
    </Sheet>
  )
}

export const DIET_LABEL: Record<DietType, string> = { veg: 'Vegetarian', egg: 'Eggetarian', nonveg: 'Non-veg' }

/** Diet / whey / excluded foods — used by every Bulk Boost suggestion. */
export function BoostPrefsFields() {
  const p = useStore(s => s.healthProfile)
  const update = useStore(s => s.updateHealth)
  const prefs = boostPrefs(p)
  const [showFoods, setShowFoods] = useState(false)
  const foods = BOOST_FOODS.filter(f => (f.diet === 'veg' || f.diet === prefs.diet || (f.diet === 'egg' && prefs.diet === 'nonveg')) && (!f.whey || prefs.whey))
  return (
    <>
      <Field label="Diet (Bulk Boost suggestions)">
        <div className="flex gap-1.5">{(['veg', 'egg', 'nonveg'] as const).map(d => <button key={d} onClick={() => update({ diet: d })} className={`flex-1 h-9 rounded-full text-xs font-bold ${prefs.diet === d ? 'bg-lavender text-[#1B1430]' : 'glass text-ink-2'}`}>{DIET_LABEL[d]}</button>)}</div>
      </Field>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-2">Suggest whey protein</span>
        <button onClick={() => update({ whey: !prefs.whey })} className={`h-7 w-12 rounded-full p-0.5 transition-colors ${prefs.whey ? 'bg-success' : 'bg-white/15'}`} aria-label="Toggle whey">
          <motion.span layout className={`block size-6 rounded-full bg-white ${prefs.whey ? 'ml-auto' : ''}`} />
        </button>
      </div>
      <div>
        <button onClick={() => setShowFoods(v => !v)} className="text-xs font-bold text-lavender">{showFoods ? 'Hide' : 'Foods I don’t eat'}{prefs.exclude.length ? ` · ${prefs.exclude.length} hidden` : ''}</button>
        {showFoods && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {foods.map(f => {
              const off = prefs.exclude.includes(f.id)
              return <button key={f.id} onClick={() => update({ excludeFoods: off ? prefs.exclude.filter(x => x !== f.id) : [...prefs.exclude, f.id] })}
                className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border ${off ? 'border-danger/40 text-danger line-through bg-danger/8' : 'border-white/10 text-ink-2'}`}>{f.emoji} {f.name.replace(/\s*\(.*\)/, '')}</button>
            })}
          </div>
        )}
      </div>
    </>
  )
}
