import { motion } from 'framer-motion'
import { ChevronRight, Droplets, Dumbbell, Minus, Plus, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { calorieAdvice, personalRecords, weightTrend } from '../lib/insightsPlus'
import { dateKey, prettyDate, uid } from '../lib/time'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { Pill, spring } from './ui'

/** Bulk progress: weekly weigh-in, trend (kg/week) and a one-tap calorie adjustment. */
export function WeightCard() {
  const weights = useStore(s => s.weights)
  const profile = useStore(s => s.healthProfile)
  const save = useStore(s => s.save)
  const updateHealth = useStore(s => s.updateHealth)
  const today = dateKey()
  const todays = weights.find(w => w.date === today)
  const [kg, setKg] = useState(todays ? String(todays.kg) : '')
  const sorted = useMemo(() => [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-12), [weights])
  const trend = weightTrend(weights)
  const advice = calorieAdvice(trend?.perWeek ?? null, profile.goal)
  const W = 300, H = 60
  const min = Math.min(...sorted.map(w => w.kg)) - 0.3, max = Math.max(...sorted.map(w => w.kg)) + 0.3
  const pts = sorted.map((w, i) => [sorted.length === 1 ? W / 2 : (i / (sorted.length - 1)) * W, H - ((w.kg - min) / (max - min || 1)) * H])
  return (
    <div className="glass rounded-[22px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold"><Scale size={16} className="text-peach" /> Body weight</span>
        {trend && <span className={`text-xs font-bold ${trend.perWeek > 0 ? 'text-success' : 'text-warning'}`}>{trend.perWeek > 0 ? '+' : ''}{trend.perWeek} kg/week</span>}
      </div>
      {sorted.length >= 2 && (
        <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} className="w-full h-16 overflow-visible">
          <defs><linearGradient id="wg" x1="0" x2="1"><stop offset="0" stopColor="#FFC4AE" /><stop offset="1" stopColor="#9BE7C4" /></linearGradient></defs>
          <motion.polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="url(#wg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 } as never} animate={{ pathLength: 1 } as never} transition={{ duration: 1 }} />
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? '#9BE7C4' : '#FFC4AE'} />)}
        </svg>
      )}
      <div className="flex gap-2">
        <input type="number" inputMode="decimal" step="0.1" className="field flex-1" placeholder={`Today's weight (kg)${sorted.length ? ` · last ${sorted[sorted.length - 1].kg}` : ''}`} value={kg} onChange={e => setKg(e.target.value)} />
        <Pill variant="lavender" disabled={!(Number(kg) > 25 && Number(kg) < 250)} onClick={() => {
          save('weights', { id: todays?.id ?? uid(), date: today, kg: Math.round(Number(kg) * 10) / 10 })
          if (!profile.weightKg || Math.abs(profile.weightKg - Number(kg)) >= 0.5) updateHealth({ weightKg: Math.round(Number(kg) * 10) / 10 })
        }}>{todays ? 'Update' : 'Log'}</Pill>
      </div>
      {advice ? (
        <div className="rounded-2xl bg-white/[.04] p-3 text-xs space-y-2">
          <div className="text-ink-2">{advice.text}</div>
          {advice.delta !== 0 && (
            <Pill className="h-8 text-[11px]" onClick={() => updateHealth({ kcalAdjust: (profile.kcalAdjust ?? 0) + advice.delta })}>
              Apply {advice.delta > 0 ? '+' : ''}{advice.delta} kcal to my target
            </Pill>
          )}
          {(profile.kcalAdjust ?? 0) !== 0 && <div className="text-[10px] text-ink-3">Current adjustment: {profile.kcalAdjust! > 0 ? '+' : ''}{profile.kcalAdjust} kcal · <button className="underline" onClick={() => updateHealth({ kcalAdjust: 0 })}>reset</button></div>}
        </div>
      ) : <div className="text-[11px] text-ink-3">Weigh in weekly (same time, after waking). After 3 weigh-ins over 10+ days Kairo tells you whether to eat more or less.</div>}
      {sorted.length > 0 && <div className="text-[10px] text-ink-3">Last: {sorted[sorted.length - 1].kg} kg on {prettyDate(sorted[sorted.length - 1].date)} · {weights.length} weigh-ins</div>}
    </div>
  )
}

/** Water: tap a glass. Goal is editable (bulking needs more water). */
export function WaterCard() {
  const today = dateKey()
  const n = useStore(s => s.water[today] ?? 0)
  const goal = useStore(s => s.targets2.waterGlasses)
  const addWater = useStore(s => s.addWater)
  const updateTargets2 = useStore(s => s.updateTargets2)
  return (
    <div className="glass rounded-[22px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold"><Droplets size={16} className="text-[#8FB8FF]" /> Water</span>
        <span className="text-xs text-ink-2"><b className="text-ink text-sm">{n}</b> / {goal} glasses · {(n * 0.25).toFixed(2)} L
          <button className="ml-2 text-ink-3 underline" onClick={() => { const v = Number(window.prompt('Daily goal (250 ml glasses)', String(goal))); if (v >= 4 && v <= 30) updateTargets2({ waterGlasses: Math.round(v) }) }}>goal</button></span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: goal }, (_, i) => (
          <motion.button key={i} whileTap={{ scale: 0.8 }} transition={spring} onClick={() => addWater(today, (i === n - 1 ? i : i + 1) - n) /* tap glass i → fill up to it; tap the last full glass → empty it */}
            aria-label={`Glass ${i + 1}`} className="w-[22px] h-7 rounded-b-lg rounded-t-sm border border-[#8FB8FF]/40 overflow-hidden relative">
            <motion.span className="absolute inset-x-0 bottom-0 bg-[#8FB8FF]" initial={false} animate={{ height: i < n ? '100%' : '0%' }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} />
          </motion.button>
        ))}
      </div>
      <div className="flex gap-2">
        <Pill className="flex-1 h-9 text-xs" disabled={!n} onClick={() => addWater(today, -1)}><Minus size={14} /> Glass</Pill>
        <Pill variant="lavender" className="flex-1 h-9 text-xs" onClick={() => { addWater(today, 1); navigator.vibrate?.(10) }}><Plus size={14} /> Glass</Pill>
      </div>
    </div>
  )
}

export function WorkoutsLink() {
  const workouts = useStore(s => s.workouts)
  const data = useStore()
  const open = useNav(s => s.open)
  const prs = useMemo(() => personalRecords(data), [data])
  const last = [...workouts].sort((a, b) => b.date.localeCompare(a.date))[0]
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={() => open('workouts')} className="w-full text-left glass rounded-[22px] p-4 flex items-center gap-3">
      <div className="size-11 rounded-2xl grid place-items-center bg-pink/15 shrink-0"><Dumbbell size={20} className="text-pink" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">Workout log</div>
        <div className="text-[11px] text-ink-2 truncate">{last ? `Last: ${prettyDate(last.date)} · ${last.exercises.length} exercises · ${prs.size} PRs tracked` : 'Log sets, reps and weight — Kairo tracks your PRs and overload.'}</div>
      </div>
      <ChevronRight size={16} className="text-ink-3" />
    </motion.button>
  )
}
