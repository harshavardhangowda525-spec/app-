import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ChevronRight, ImagePlus, Moon, Plus, RefreshCw, Smartphone, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Field, MiniBars, Pill, ScreenHeader, Section, Sheet, confirmDelete, spring } from '../components/ui'
import { bulkScore, detectSleep, sleepLabel, sleepScore, sum, targets, type Targets } from '../lib/health'
import { openUsageAccess, screenEvents, sleepAvailable, sleepPermission } from '../lib/sleepNative'
import { addDays, dateKey, fmtDur, parseKey, prettyDate, uid, weekdayShort } from '../lib/time'
import { lastNDays as lastNDaysSafe } from '../lib/analytics'
import type { FoodItem, MealEntry, SleepRecord } from '../lib/types'
import { GoodNightCard, MorningCheckIn } from '../components/SleepWeb'
import { WaterCard, WeightCard, WorkoutsLink } from '../components/HealthPlus'
import { BoostCard, BoostPrefsFields, BoostedKcal, GapSheet } from '../components/BulkBoost'
import { dayGap } from '../lib/boost'
import { Zap } from 'lucide-react'
import { LandingFx, LiquidOrb, MacroRing, ScanCounter } from '../components/FoodMotion'
import { useReducedMotion } from 'framer-motion'
import { analyzeMeal, compressImage, getXaiKey, providerName } from '../lib/vision'
import { useStore } from '../store/useStore'

const APPETITE = [['😶', 'None'], ['🙂', 'Light'], ['😋', 'Hungry'], ['🤤', 'Very'], ['🔥', 'Starving']] as const
const RESTED = [['😫', 'Drained'], ['😕', 'Tired'], ['🙂', 'OK'], ['😌', 'Rested'], ['⚡', 'Energised']] as const
const GOAL_LABEL = { 'lean-bulk': 'Lean bulk', bulk: 'Bulk', maintain: 'Maintain' } as const
const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Health() {
  const today = dateKey()
  const profile = useStore(s => s.healthProfile)
  const meals = useStore(s => s.meals)
  const appetite = useStore(s => s.appetite)
  const sleeps = useStore(s => s.sleeps)
  const save = useStore(s => s.save)
  const t = targets(profile)
  const todayMeals = meals.filter(m => m.date === today).sort((a, b) => a.at - b.at)
  const tot = sum(todayMeals)
  const lastSleep = [...sleeps].sort((a, b) => b.wake - a.wake)[0]
  const todayAppetite = appetite.filter(a => a.date === today)
  const latestAppetite = todayAppetite[todayAppetite.length - 1]
  const [profileOpen, setProfileOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [mealOpen, setMealOpen] = useState<MealEntry | 'new' | { title: string; items: FoodItem[] } | null>(null)
  const [gapOpen, setGapOpen] = useState(false)
  const [landing, setLanding] = useState<MealEntry | null>(null)
  const fuelRef = useRef<HTMLDivElement>(null!)
  const gap = dayGap(tot, t)
  const showGapCta = !!gap && new Date().getHours() >= 16
  useAutoSleep()

  return (
    <div className="space-y-3.5">
      <ScreenHeader kicker="Body · Fuel · Recovery" title="Health"
        right={<button onClick={() => setProfileOpen(true)} className="h-8 px-3 rounded-full text-[11px] font-bold text-success bg-success/12 border border-success/35">Goal · {GOAL_LABEL[profile.goal]}</button>} />

      <MorningCheckIn />
      <GoodNightCard />

      {/* Sleep card */}
      <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} onClick={() => setSleepOpen(true)}
        className="w-full text-left rounded-[24px] p-4 flex items-center gap-4"
        style={{ background: 'linear-gradient(140deg,#2b3361,#191433)', border: '1px solid rgb(143 184 255 / .3)' }}>
        <ScoreRing value={lastSleep?.score ?? 0} size={92} label="SLEEP" empty={!lastSleep} />
        <div className="flex-1 min-w-0">
          {lastSleep ? (
            <>
              <div className="text-[10px] font-extrabold tracking-[.12em] text-lavender">☾ {lastSleep.date === today ? 'LAST NIGHT' : prettyDate(lastSleep.date).toUpperCase()} · {sleepLabel(lastSleep.score).toUpperCase()}</div>
              <div className="text-2xl font-extrabold tracking-tight">{fmtDur(lastSleep.asleepMin)}</div>
              <div className="text-[11px] text-ink-2 font-semibold">{fmtTime(lastSleep.sleepStart)} → {fmtTime(lastSleep.wake)} · goal {fmtDur(profile.sleepGoalMin)}</div>
              <MiniTimeline r={lastSleep} />
              <div className="text-[9.5px] text-ink-3 font-semibold mt-1">{lastSleep.source === 'auto' ? 'Auto · phone idle after 10 PM' : 'Good-night tap + morning check-in'}</div>
            </>
          ) : (
            <>
              <div className="text-[10px] font-extrabold tracking-[.12em] text-lavender">☾ SLEEP</div>
              <div className="text-[16px] text-ink font-extrabold">Tracking starts tonight</div>
              <div className="text-[11px] text-ink-2 leading-snug">{sleepAvailable() ? 'After 10 PM, Kairo reads when your phone goes idle.' : 'Tap “Good night” before bed; open Kairo when you wake.'}</div>
            </>
          )}
        </div>
        <ChevronRight size={16} className="text-ink-3" />
      </motion.button>

      {/* Fuel card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-[24px] p-4 space-y-3">
        {t ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
              <FuelRing pct={tot.kcal / t.kcal} innerRef={fuelRef} />
              <div>
                <div className="label !text-ink-3">Fuel today</div>
                <div><motion.b key={tot.kcal} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="inline-block text-[26px] font-extrabold tracking-tight text-peach">{Math.round(tot.kcal).toLocaleString('en-IN')}</motion.b>
                  <span className="text-xs text-ink-2 font-semibold"> / {t.kcal.toLocaleString('en-IN')} kcal</span></div>
              </div>
              </div>
              <button onClick={() => gap && setGapOpen(true)} className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold ${tot.kcal >= t.kcal ? 'bg-success/15 text-success' : 'bg-warning/12 text-warning'}`}>
                {tot.kcal >= t.kcal ? 'Surplus hit ✓' : `${Math.round(t.kcal - tot.kcal)} kcal short`}
              </button>
            </div>
            <GBar pct={(tot.kcal / t.kcal) * 100} grad="linear-gradient(90deg,#FFC4AE,#FF8FA8)" h={8} />
            <div className="flex gap-2.5">
              {([['Protein', tot.protein, t.protein, '#9BE7C4'], ['Carbs', tot.carbs, t.carbs, '#FFCF7A'], ['Fat', tot.fat, t.fat, '#FF9ECF']] as const).map(([l, v, g, c], i) => (
                <div key={l} className="flex-1 min-w-0">
                  <div className="text-[11px] text-ink-2 font-semibold">{l}</div>
                  <div className="my-1"><GBar pct={(v / g) * 100} grad={c} h={5} delay={0.2 + i * 0.1} /></div>
                  <div className="text-[11px] font-bold">{Math.round(v)} / {g} g</div>
                </div>
              ))}
            </div>
            {showGapCta && (
              <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.4 }} whileTap={{ scale: 0.96 }}
                onClick={() => setGapOpen(true)} className="w-full h-11 rounded-full font-extrabold text-sm text-[#1B1430] flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(90deg,#C9B8FF,#FFB59A)' }}>
                <Zap size={15} fill="currentColor" /> Close today's gap{gap!.protein >= 10 ? ` · ${gap!.protein} g protein` : ''}
              </motion.button>
            )}
          </>
        ) : (
          <button onClick={() => setProfileOpen(true)} className="w-full text-left">
            <div className="label !text-ink-3">Fuel today · {Math.round(tot.kcal)} kcal</div>
            <div className="font-bold mt-1">Set your weight, height & age</div>
            <div className="text-xs text-ink-2">Kairo calculates your daily calorie and protein targets for a {GOAL_LABEL[profile.goal].toLowerCase()}.</div>
          </button>
        )}
      </motion.div>

      <WeightCard />
      <WorkoutsLink />
      <WaterCard />

      {/* Appetite */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-[22px] px-4 py-3.5">
        <div className="flex justify-between mb-2.5"><b className="text-[13px]">Appetite right now</b><span className="text-[11px] text-ink-3 font-semibold">{todayAppetite.length ? `logged ${todayAppetite.length}× today` : 'tap to log'}</span></div>
        <div className="flex gap-1.5">
          {APPETITE.map(([e, l], i) => {
            const on = latestAppetite?.level === i + 1 && Date.now() - latestAppetite.at < 3 * 3600e3
            return (
              <motion.button key={l} whileTap={{ scale: 0.88 }} onClick={() => { save('appetite', { id: uid(), at: Date.now(), date: today, level: i + 1 }); navigator.vibrate?.(15) }}
                className={`flex-1 rounded-[14px] pt-2 pb-1.5 border ${on ? 'bg-peach/18 border-peach/60' : 'border-transparent'}`}>
                <motion.div key={on ? 'on' : 'off'} initial={on ? { scale: 0.6 } : false} animate={{ scale: 1 }} transition={spring} className="text-lg">{e}</motion.div>
                <div className={`text-[9px] font-bold ${on ? 'text-peach' : 'text-ink-3'}`}>{l}</div>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Meals */}
      <Section title="Meals today" right={<span className="text-xs font-semibold text-lavender">{todayMeals.length} logged</span>}>
        <div className="space-y-2">
          {todayMeals.map((m, i) => <MealRow key={m.id} m={m} t={t} delay={0.2 + i * 0.05} onClick={() => setMealOpen(m)} />)}
          {todayMeals.length === 0 && <div className="glass rounded-[18px] p-4 text-sm text-ink-3">No meals yet — snap your first plate.</div>}
        </div>
      </Section>

      <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} whileTap={{ scale: 0.96 }} onClick={() => setMealOpen('new')}
        className="w-full h-[52px] rounded-[26px] flex items-center justify-center gap-2 font-extrabold text-on-peach shadow-[0_10px_24px_rgba(255,140,140,.4)]"
        style={{ background: 'linear-gradient(90deg,#FFC79E,#EE789E)' }}>
        <Camera size={20} /> Snap a meal
      </motion.button>

      <WeekFuel t={t} />

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SleepView open={sleepOpen} onClose={() => setSleepOpen(false)} />
      <GapSheet open={gapOpen} onClose={() => setGapOpen(false)} gap={gap} onTweak={(title, items) => setMealOpen({ title, items })} />
      {mealOpen && <MealFlow initial={mealOpen === 'new' || !('id' in mealOpen) ? null : mealOpen} preset={mealOpen !== 'new' && !('id' in mealOpen) ? mealOpen : undefined} t={t} onClose={() => setMealOpen(null)}
        onLogged={m => { setMealOpen(null); setLanding(m) }} />}
      {landing && <LandingFx title={landing.title} kcal={landing.kcal} photo={landing.photo} target={fuelRef.current} onDone={() => setLanding(null)} />}
    </div>
  )
}

/* ---------------- shared bits ---------------- */

function FuelRing({ pct, innerRef }: { pct: number; innerRef: React.RefObject<HTMLDivElement> }) {
  const r = 22, C = 2 * Math.PI * r
  return (
    <div ref={innerRef} className="relative size-[54px] shrink-0">
      <svg viewBox="0 0 54 54" className="size-full -rotate-90">
        <defs><linearGradient id="fuelg"><stop offset="0" stopColor="#FFC4AE" /><stop offset="1" stopColor="#FF8FA8" /></linearGradient></defs>
        <circle cx="27" cy="27" r={r} fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth="6" />
        <motion.circle cx="27" cy="27" r={r} fill="none" stroke="url(#fuelg)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C}
          initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - Math.min(1, pct)) }} transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ filter: 'drop-shadow(0 0 5px #ff8fa8aa)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[11px] font-extrabold">{Math.round(Math.min(1, pct) * 100)}%</div>
    </div>
  )
}

function GBar({ pct, grad, h, delay = 0.1 }: { pct: number; grad: string; h: number; delay?: number }) {
  return (
    <div className="rounded-full bg-white/8 overflow-hidden" style={{ height: h }}>
      <motion.div className="h-full rounded-full origin-left" style={{ background: grad, width: `${Math.min(100, pct)}%` }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, delay, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  )
}

function ScoreRing({ value, size, label, empty, big }: { value: number; size: number; label: string; empty?: boolean; big?: boolean }) {
  const sw = big ? 10 : 7, r = (size - sw) / 2 - 2, c = 2 * Math.PI * r
  const id = `sg${size}`
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id={id}><stop offset="0" stopColor="#6E8BEA" /><stop offset="1" stopColor="#C9B8FF" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth={sw} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - (empty ? 0 : value / 100)) }} transition={{ duration: 1.6, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ filter: 'drop-shadow(0 0 6px #8fb8ff)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          {big && <div className="text-[38px] leading-none">🌙</div>}
          <div className={`${big ? 'text-[44px]' : 'text-[28px]'} font-extrabold tracking-[-0.05em] leading-none`}>{empty ? '—' : value}</div>
          <div className="text-[9px] font-extrabold tracking-[.14em] text-[#8FB8FF] mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  )
}

function MiniTimeline({ r }: { r: SleepRecord }) {
  const segs = (r.timeline ?? []).filter(s => s.end > r.sleepStart - 30 * 60e3 && s.start < r.wake + 30 * 60e3)
  if (!segs.length) return <div className="h-[9px] mt-2 rounded bg-[#8fb8ff]" />
  return (
    <div className="flex gap-[2px] h-[9px] mt-2">
      {segs.map((s, i) => <i key={i} className="rounded-[3px]" style={{ flex: Math.max(1, (s.end - s.start) / 60e3), background: s.type === 'used' ? '#FFCF7A' : (s.end - s.start) > 90 * 60e3 ? '#6E8BEA' : '#8FB8FF' }} />)}
    </div>
  )
}

function MealRow({ m, t, delay, onClick }: { m: MealEntry; t: Targets | null; delay: number; onClick: () => void }) {
  const b = bulkScore(m, t)
  return (
    <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} whileTap={{ scale: 0.98 }} onClick={onClick}
      className="w-full text-left glass rounded-[18px] p-2.5 flex items-center gap-3">
      <div className="size-12 rounded-[13px] shrink-0 overflow-hidden grid place-items-center text-xl" style={{ background: 'linear-gradient(135deg,#FFD9A0,#E8A55C)' }}>
        {m.photo ? <img src={m.photo} alt="" className="size-full object-cover" /> : '🍽️'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{m.title}</div>
        <div className="text-[11px] text-ink-3 font-semibold truncate">{fmtTime(m.at)} · {Math.round(m.kcal)} kcal · {Math.round(m.protein)} g protein</div>
      </div>
      <div className={`shrink-0 text-center rounded-[11px] px-2 py-1 leading-tight ${b.score >= 6 ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning'}`}>
        <div className="text-[13px] font-extrabold">{b.score.toFixed(1)}</div><div className="text-[8px] font-bold tracking-widest">BULK</div>
      </div>
    </motion.button>
  )
}

function WeekFuel({ t }: { t: Targets | null }) {
  const meals = useStore(s => s.meals)
  const today = dateKey()
  const days = lastNDaysSafe(7, today)
  if (!meals.length) return null
  return (
    <Section title="Calories · last 7 days">
      <div className="glass rounded-[20px] p-4">
        <MiniBars data={days.map(d => ({ label: weekdayShort(d)[0], value: Math.round(sum(meals.filter(m => m.date === d)).kcal), highlight: d === today }))} format={v => `${(v / 1000).toFixed(1)}k`} />
        {t && <div className="text-[11px] text-ink-3 mt-2">Target {t.kcal.toLocaleString('en-IN')} kcal · {t.protein} g protein daily</div>}
      </div>
    </Section>
  )
}

/* ---------------- profile ---------------- */

function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useStore(s => s.healthProfile)
  const update = useStore(s => s.updateHealth)
  const num = (v: string) => (v === '' ? undefined : Number(v))
  const t = targets(p)
  return (
    <Sheet open={open} onClose={onClose} title="Body & goal">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Weight (kg)"><input type="number" inputMode="decimal" className="field" value={p.weightKg ?? ''} onChange={e => update({ weightKg: num(e.target.value) })} /></Field>
          <Field label="Height (cm)"><input type="number" inputMode="numeric" className="field" value={p.heightCm ?? ''} onChange={e => update({ heightCm: num(e.target.value) })} /></Field>
          <Field label="Age"><input type="number" inputMode="numeric" className="field" value={p.age ?? ''} onChange={e => update({ age: num(e.target.value) })} /></Field>
        </div>
        <Field label="Sex (for calorie formula)">
          <div className="flex gap-1.5">{(['male', 'female'] as const).map(x => <button key={x} onClick={() => update({ sex: x })} className={`flex-1 h-9 rounded-full text-xs font-bold capitalize ${(p.sex ?? 'male') === x ? 'bg-white text-on-peach' : 'glass text-ink-2'}`}>{x}</button>)}</div>
        </Field>
        <Field label="Goal">
          <div className="flex gap-1.5">{(['lean-bulk', 'bulk', 'maintain'] as const).map(g => <button key={g} onClick={() => update({ goal: g })} className={`flex-1 h-9 rounded-full text-xs font-bold ${p.goal === g ? 'bg-success text-[#0a2a1c]' : 'glass text-ink-2'}`}>{GOAL_LABEL[g]}</button>)}</div>
        </Field>
        <Field label={`Sleep goal: ${fmtDur(p.sleepGoalMin)}`}>
          <input type="range" min={360} max={600} step={15} value={p.sleepGoalMin} onChange={e => update({ sleepGoalMin: Number(e.target.value) })} className="w-full accent-[#8FB8FF]" />
        </Field>
        <BoostPrefsFields />
        {t ? (
          <div className="rounded-2xl bg-success/10 border border-success/30 p-3 text-sm">
            Daily target: <b>{t.kcal.toLocaleString('en-IN')} kcal</b> · <b>{t.protein} g</b> protein · {t.carbs} g carbs · {t.fat} g fat
            <div className="text-[11px] text-ink-2 mt-1">Maintenance × 1.55 activity {p.goal === 'maintain' ? '' : `+ ${p.goal === 'bulk' ? 500 : 300} kcal surplus`}. Adjust weekly by your weight trend.</div>
          </div>
        ) : <div className="text-xs text-ink-3">Enter weight, height and age to calculate targets.</div>}
        <Pill variant="lavender" className="w-full h-11" onClick={onClose}>Done</Pill>
      </div>
    </Sheet>
  )
}

/* ---------------- meal capture & analysis ---------------- */

type Phase = 'pick' | 'scanning' | 'reveal' | 'result' | 'error'

// Where food tags pop up on the photo during the reveal (percent of the stage).
const TAG_SPOTS = [[58, 22], [8, 38], [56, 62], [10, 70], [34, 12]] as const

function MealFlow({ initial, preset, t, onClose, onLogged }: { initial: MealEntry | null; preset?: { title: string; items: FoodItem[] }; t: Targets | null; onClose: () => void; onLogged: (m: MealEntry) => void }) {
  const reduce = useReducedMotion()
  const [burst, setBurst] = useState(0)
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const [phase, setPhase] = useState<Phase>(initial || preset ? 'result' : 'pick')
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo)
  const [title, setTitle] = useState(initial?.title ?? preset?.title ?? '')
  const [items, setItems] = useState<FoodItem[]>(initial?.items ?? preset?.items ?? [])
  const [after, setAfter] = useState<number | undefined>(initial?.appetiteAfter)
  const [err, setErr] = useState('')
  const [conf, setConf] = useState<string | undefined>()
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const tot = sum(items)
  const b = bulkScore(tot, t)
  const boostedN = items.filter(i => i.boost).length
  const baseScore = bulkScore(sum(items.filter(i => !i.boost)), t).score
  const hasKey = !!getXaiKey()

  const cam = useLiveCamera(phase === 'pick' && !initial)
  const [flash, setFlash] = useState(false)
  const onFile = async (f?: File) => { if (f) processImage(await compressImage(f)) }
  const shoot = () => {
    if (cam.state !== 'live') { camRef.current?.click(); return } // blocked/unsupported → phone camera app
    const img = cam.capture()
    if (!img) return
    setFlash(true); setTimeout(() => setFlash(false), 260); setBurst(n => n + 1)
    navigator.vibrate?.(25)
    processImage(img)
  }
  const processImage = async (img: string) => {
    setPhoto(img)
    if (!hasKey) { setItems([{ name: 'Food', kcal: 0, protein: 0, carbs: 0, fat: 0 }]); setTitle(''); setPhase('result'); return }
    setPhase('scanning')
    try {
      const r = await analyzeMeal(img)
      if (!r.items.length) throw new Error(r.title === 'Not food' ? "That doesn't look like food — try another photo." : 'No food detected.')
      setTitle(r.title); setItems(r.items); setConf(r.confidence); navigator.vibrate?.([20, 40, 20])
      if (reduce) setPhase('result')
      else { setPhase('reveal'); setTimeout(() => setPhase(p => (p === 'reveal' ? 'result' : p)), 1500 + Math.min(4, r.items.length) * 250) }
    } catch (e) { setErr((e as Error).message); setPhase('error') }
  }
  const upd = (i: number, k: keyof FoodItem, v: string) => setItems(xs => xs.map((x, j) => (j === i ? { ...x, [k]: k === 'name' ? v : Math.max(0, Number(v) || 0) } : x)))
  const log = () => {
    const m: MealEntry = {
      id: initial?.id ?? uid(), date: initial?.date ?? dateKey(), at: initial?.at ?? Date.now(), title: title.trim() || 'Meal',
      photo, items, ...tot, source: initial?.source ?? (hasKey && conf ? 'ai' : 'manual'), appetiteAfter: after,
    }
    save('meals', m); navigator.vibrate?.(30)
    if (initial) onClose(); else onLogged(m)
  }

  return createPortal(
    <motion.div className="fixed inset-0 z-[55] bg-[#07060c] overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />

      {/* camera / photo stage */}
      <div className={`absolute inset-x-0 top-0 transition-[height] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${phase === 'pick' ? 'h-full' : 'h-[58%]'}`} style={{ background: 'radial-gradient(60% 50% at 50% 40%,#3a2a24,#0d0a0a 75%)', perspective: 700 }}>
        {(phase === 'pick' && cam.state !== 'live') && <div className="kai-aurora" />}
        {phase === 'pick' && (
          <video ref={cam.videoRef} autoPlay playsInline muted className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${cam.state === 'live' ? 'opacity-100' : 'opacity-0'}`} />
        )}
        {phase === 'pick' && cam.state === 'starting' && (
          <div className="absolute inset-0 grid place-items-center"><div className="flex flex-col items-center gap-3 text-sm text-ink-2"><span className="size-7 rounded-full border-2 border-peach/30 border-t-peach animate-spin" />Opening camera…</div></div>
        )}
        {phase === 'pick' && (cam.state === 'denied' || cam.state === 'unsupported') && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl bg-black/60 border border-white/15 p-5 text-center space-y-3">
            <Camera size={28} className="mx-auto text-peach" />
            <div className="font-bold">{cam.state === 'denied' ? 'Camera access is off' : 'Live camera not available here'}</div>
            <div className="text-xs text-ink-2 leading-relaxed">{cam.state === 'denied' ? 'Allow camera for Kairo (Android Settings → Apps → Kairo → Permissions → Camera), then try again.' : 'Use your phone camera or pick a photo instead.'}</div>
            <div className="flex gap-2 justify-center">
              {cam.state === 'denied' && <Pill variant="lavender" className="h-9 text-xs" onClick={cam.restart}>Try again</Pill>}
              <Pill className="h-9 text-xs" onClick={() => camRef.current?.click()}>Use phone camera</Pill>
            </div>
          </div>
        )}
        <AnimatePresence>{flash && <motion.div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(circle at 50% 85%,#fff,#ffffffd9 45%,#ffffff66 80%)' }} initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />}</AnimatePresence>
        {photo && (
          <motion.div className="absolute inset-0 overflow-hidden" initial={reduce ? false : { clipPath: 'circle(0% at 50% 50%)' }} animate={{ clipPath: 'circle(150% at 50% 50%)' }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
            <motion.img src={photo} alt="" className="absolute inset-0 size-full object-cover" initial={{ scale: 1.12 }}
              animate={phase === 'scanning' && !reduce ? { scale: 1.04, rotateX: [6, 12, 6], rotateZ: [-1.5, 1.5, -1.5], opacity: 0.88 } : { scale: 1, rotateX: 0, rotateZ: 0, opacity: 1 }}
              transition={phase === 'scanning' ? { duration: 5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }} />
          </motion.div>
        )}
        {(phase === 'scanning' || phase === 'reveal') && !reduce && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="kai-orbit kai-o3" /><div className="kai-orbit kai-o1" /><div className="kai-orbit kai-o2" />
            {phase === 'scanning' && <div className="kai-beam" />}
            <div className="kai-scanlines" />
          </div>
        )}
        {phase === 'reveal' && items.slice(0, TAG_SPOTS.length).map((it, i) => {
          const [x, y] = TAG_SPOTS[i]
          return (
            <motion.div key={i} className="absolute z-[5] rounded-[12px] px-2.5 py-1.5 border border-peach/60 bg-[#0b0a12]/85 backdrop-blur shadow-[0_0_16px_#ffb59a55]"
              style={{ left: `${x}%`, top: `${y}%` }} initial={{ scale: 0, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.15 + i * 0.25 }}>
              <div className="text-[11px] font-extrabold max-w-[130px] truncate">{it.name}</div>
              <div className="text-[9.5px] font-bold text-peach">{it.grams ? `${it.grams} g · ` : ''}{Math.round(it.kcal)} kcal</div>
            </motion.div>
          )
        })}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        {phase === 'pick' && (
          <div className="absolute left-[44px] right-[44px] top-[18%] bottom-[30%]">
            {([['left-0 top-0 border-r-0 border-b-0 rounded-tl-xl', -26, -26], ['right-0 top-0 border-l-0 border-b-0 rounded-tr-xl', 26, -26], ['left-0 bottom-0 border-r-0 border-t-0 rounded-bl-xl', -26, 26], ['right-0 bottom-0 border-l-0 border-t-0 rounded-br-xl', 26, 26]] as const).map(([c, ox, oy], i) =>
              <motion.i key={c} className={`absolute size-9 border-[3px] border-peach ${c}`} style={{ filter: 'drop-shadow(0 0 6px #ffb59a88)' }}
                initial={reduce ? false : { x: ox, y: oy, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.25 + i * 0.05 }} />)}
            {cam.state === 'live' && !reduce && <div className="absolute left-1/2 top-1/2"><div className="kai-radar" /><div className="kai-radar" style={{ animationDelay: '1.2s' }} /></div>}
          </div>
        )}
        <div className="absolute top-[max(16px,env(safe-area-inset-top))] inset-x-4 flex justify-between items-center">
          <button onClick={onClose} aria-label="Close" className="size-9 rounded-full bg-black/50 border border-white/15 grid place-items-center"><X size={16} /></button>
          <span className="rounded-full bg-black/55 border border-white/15 px-3 py-1.5 text-[11px] font-bold">
            {phase === 'scanning' ? `Analysing with ${providerName()}…` : phase === 'reveal' ? `${items.length} food${items.length === 1 ? '' : 's'} found` : phase === 'pick' ? 'Frame your plate' : phase === 'error' ? 'Analysis failed' : initial ? 'Edit meal' : 'Review & log'}
          </span>
          <span className="size-9" />
        </div>
        {phase === 'pick' && (
          <div className="absolute bottom-[max(28px,env(safe-area-inset-bottom))] inset-x-0 flex flex-col items-center gap-4">
          <div className="text-[13px] font-semibold text-white/85 drop-shadow">{cam.state === 'live' ? 'Fit the whole plate inside the frame' : hasKey ? '' : 'Add a Groq key in Settings for auto-analysis'}</div>
          <div className="flex items-center justify-center gap-8">
            <button onClick={() => galRef.current?.click()} aria-label="Choose from gallery" className="size-12 rounded-full bg-black/50 border border-white/15 grid place-items-center"><ImagePlus size={20} /></button>
            <div className="relative">
            <AnimatePresence>{burst > 0 && <motion.span key={burst} className="absolute -inset-3 rounded-full border-2 border-peach pointer-events-none" initial={{ scale: 0.8, opacity: 1 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} />}</AnimatePresence>
            <motion.button whileTap={{ scale: 0.88 }} onClick={shoot} aria-label="Take photo" disabled={cam.state === 'starting'}
              className="size-[78px] rounded-full grid place-items-center ring-4 ring-white/40 shadow-[0_0_30px_rgba(255,181,154,.5)] disabled:opacity-50" style={{ background: 'radial-gradient(circle,#fff 58%,#ffe3d6)' }}>
              {cam.state === 'live' ? <span className="size-[62px] rounded-full border-2 border-[#2A1420]/15" /> : <Camera size={28} color="#2A1420" />}
            </motion.button>
            </div>
            <button onClick={() => { setItems([{ name: '', kcal: 0, protein: 0, carbs: 0, fat: 0 }]); setPhase('result') }} aria-label="Enter manually" className="size-12 rounded-full bg-black/50 border border-white/15 grid place-items-center text-[10px] font-bold">Type</button>
          </div>
          </div>
        )}
      </div>

      {/* bottom area */}
      <AnimatePresence>
        {false && (
          <motion.div key="pick" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute inset-x-0 bottom-0 top-[58%] px-5 pt-6 text-center space-y-2">
            <div className="text-lg font-extrabold">Snap your plate</div>
            <div className="text-sm text-ink-2">{hasKey ? `${providerName()} identifies the food, portions, calories and macros. Kairo scores it for your bulk.` : 'Add your Groq or Grok key in Settings for automatic analysis — or type the food yourself.'}</div>
          </motion.div>
        )}
        {(phase === 'scanning' || phase === 'reveal') && (
          <motion.div key="scan" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute inset-x-0 bottom-0 top-[58%] px-6 pt-4">
            <div className="text-center">
              <div className="label !text-ink-3 !text-[10px]">{phase === 'reveal' ? 'Total' : 'Counting…'}</div>
              <div className="text-[46px] leading-none font-black tracking-[-0.04em] mt-1 text-peach" style={{ textShadow: '0 0 22px #ff8fa866' }}>
                <ScanCounter final={phase === 'reveal' ? Math.round(tot.kcal) : null} /><span className="text-[16px] font-extrabold text-ink-2 ml-1">kcal</span>
              </div>
            </div>
            <div className="space-y-2.5 mt-5">
              {['Identifying the foods', 'Estimating portions', 'Macros & bulk score'].map((l, i) => {
                const ok = phase === 'reveal'
                return (
                  <motion.div key={l} className="flex items-center gap-3" initial={{ opacity: 0.25 }} animate={{ opacity: [0.25, 1, 1] }} transition={{ delay: i * 0.9, duration: 0.6 }}>
                    <span className="relative size-5 grid place-items-center">
                      {ok ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15, delay: i * 0.08 }} className="size-5 rounded-full bg-success text-[#0a2a1c] grid place-items-center text-[11px] font-black">✓</motion.span>
                        : <motion.span className="absolute inset-0 rounded-full border-2 border-peach/30 border-t-peach" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear', delay: i * 0.9 }} />}
                    </span>
                    <span className="text-sm font-semibold">{l}</span>
                  </motion.div>
                )
              })}
            </div>
            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden mt-4">
              <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#FFB59A,#C9B8FF)' }} initial={{ width: '4%' }}
                animate={{ width: phase === 'reveal' ? '100%' : '88%' }} transition={{ duration: phase === 'reveal' ? 0.5 : 9, ease: phase === 'reveal' ? 'easeOut' : [0.1, 0.6, 0.3, 1] }} />
            </div>
          </motion.div>
        )}
        {phase === 'error' && (
          <motion.div key="err" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute inset-x-0 bottom-0 top-[58%] px-5 pt-6 space-y-3">
            <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{err}</div>
            <div className="flex gap-2">
              <Pill className="flex-1" onClick={() => setPhase('pick')}>Try again</Pill>
              <Pill variant="lavender" className="flex-1" onClick={() => { setItems([{ name: '', kcal: 0, protein: 0, carbs: 0, fat: 0 }]); setPhase('result') }}>Enter manually</Pill>
            </div>
          </motion.div>
        )}
        {phase === 'result' && (
          <motion.div key="res" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 28, delay: 0.1 }}
            className="kai-sheet-sweep absolute inset-x-0 bottom-0 max-h-[72%] overflow-y-auto overflow-x-hidden no-scrollbar rounded-t-[28px] bg-elevated border-t border-white/10 px-[18px] pt-3 pb-[max(20px,env(safe-area-inset-bottom))] space-y-3">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-end justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="label !text-ink-3">{boostedN && !initial ? 'Boosted meal' : conf ? `Detected · ${conf} confidence` : initial ? fmtTime(initial.at) : 'Meal'}</div>
                <input className="bg-transparent text-xl font-extrabold tracking-tight w-full outline-none" placeholder="Meal name" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <BoostedKcal items={items} conf={conf} />
            </div>
            <div className="flex gap-2">
              {([['Protein', tot.protein, (t?.protein ?? 130) / 4, '#9BE7C4'], ['Carbs', tot.carbs, (t?.carbs ?? 380) / 4, '#FFCF7A'], ['Fat', tot.fat, (t?.fat ?? 80) / 4, '#FF9ECF']] as const).map(([l, v, g, c], i) => (
                <MacroRing key={l} value={v} goal={g} color={c} label={l} delay={0.35 + i * 0.22} />
              ))}
            </div>
            {tot.kcal > 0 && (
              <motion.div key={b.score >= 6 ? 'good' : 'light'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: boostedN ? 0.05 : 0.5 }}
                className={`rounded-[18px] p-3 flex gap-3 items-center border ${b.score >= 6 ? 'border-success/40' : 'border-warning/40'}`}
                style={{ background: b.score >= 6 ? 'linear-gradient(135deg,#9be7c426,#9be7c40a)' : 'linear-gradient(135deg,#ffcf7a26,#ffcf7a0a)' }}>
                <LiquidOrb key={b.score} score={b.score} />
                <div className="min-w-0"><b className={`text-sm ${b.score >= 6 ? 'text-success' : 'text-warning'}`}>{b.verdict}</b><div className="text-[11px] text-ink-2 leading-snug">{boostedN ? `${baseScore.toFixed(1)} → ${b.score.toFixed(1)} with ${boostedN} add-on${boostedN > 1 ? 's' : ''}.${b.score >= 8 ? ' Meal target met ✓' : ''}` : b.tip}</div></div>
              </motion.div>
            )}
            <BoostCard items={items} setItems={setItems} t={t} />
            <div className="space-y-1.5">
              <div className="label">Items {conf ? '· tap to correct' : ''}</div>
              {items.map((it, i) => (
                <div key={i} className="glass rounded-xl p-2 space-y-1.5">
                  <div className="flex gap-1.5 items-center">
                    <input className="field !py-1.5 !text-[13px] flex-1" placeholder="Food (e.g. Paneer, 120 g)" value={it.name} onChange={e => upd(i, 'name', e.target.value)} />
                    <button onClick={() => setItems(xs => xs.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={14} className="text-ink-3" /></button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['kcal', 'protein', 'carbs', 'fat'] as const).map(k => (
                      <label key={k} className="text-[9px] text-ink-3 font-bold uppercase">{k === 'kcal' ? 'kcal' : `${k} g`}
                        <input type="number" inputMode="decimal" className="field !py-1 !px-2 !text-[12px] mt-0.5" value={it[k] || ''} onChange={e => upd(i, k, e.target.value)} /></label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => setItems(xs => [...xs, { name: '', kcal: 0, protein: 0, carbs: 0, fat: 0 }])} className="text-xs font-bold text-lavender flex items-center gap-1"><Plus size={13} /> Add item</button>
            </div>
            <div>
              <div className="label mb-1.5">Appetite after eating</div>
              <div className="flex gap-1.5">{APPETITE.map(([e, l], i) => (
                <button key={l} onClick={() => setAfter(i + 1)} className={`flex-1 rounded-xl py-1.5 text-[16px] border ${after === i + 1 ? 'bg-peach/18 border-peach/60' : 'border-white/8'}`}>{e}<div className="text-[8px] font-bold text-ink-3">{l}</div></button>
              ))}</div>
            </div>
            <div className="flex gap-2 pt-1">
              {initial ? <Pill variant="danger" onClick={() => { if (confirmDelete('this meal')) { remove('meals', initial.id); onClose() } }}><Trash2 size={16} /></Pill>
                : <Pill className="flex-1 h-12" onClick={() => setPhase('pick')}>Retake</Pill>}
              <Pill variant="white" className="flex-1 h-12" disabled={!items.length || tot.kcal <= 0} onClick={log}>{initial ? 'Save' : boostedN ? 'Log boosted meal' : 'Log meal'}</Pill>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  )
}

/* ---------------- in-app live camera ---------------- */

type CamState = 'off' | 'starting' | 'live' | 'denied' | 'unsupported'

/** Rear camera stream inside Kairo (asks permission once; no jump to the phone's camera app). */
function useLiveCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CamState>('off')
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!active) return
    if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return }
    let cancelled = false
    setState('starting')
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } })
      .then(async stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        if (v) { v.srcObject = stream; await v.play().catch(() => {}) }
        setState('live')
      })
      .catch(e => { if (!cancelled) setState(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'unsupported') })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [active, nonce])
  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return null
    const max = 1024, s = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    streamRef.current?.getTracks().forEach(t => t.stop()) // release the camera right after the shot
    return c.toDataURL('image/jpeg', 0.75)
  }
  return { videoRef, state, capture, restart: () => setNonce(n => n + 1) }
}

/* ---------------- sleep ---------------- */

/** On Android, detect last night's sleep from screen history once per morning. */
function useAutoSleep() {
  const sleeps = useStore(s => s.sleeps)
  const profile = useStore(s => s.healthProfile)
  const save = useStore(s => s.save)
  useEffect(() => {
    if (!sleepAvailable()) return
    const today = dateKey(), now = new Date()
    if (now.getHours() < 4 || sleeps.some(r => r.date === today)) return
    ;(async () => {
      if (!(await sleepPermission())) return
      const from = parseKey(addDays(today, -1)).getTime() + (21 * 60 + 30) * 60e3
      const to = Math.min(Date.now(), parseKey(today).getTime() + 12 * 3600e3)
      const d = detectSleep(await screenEvents(from, to), from, to, true)
      if (!d) return
      const rec: SleepRecord = { id: uid(), date: today, ...d, score: 0, source: 'auto' }
      rec.score = sleepScore(rec, profile.sleepGoalMin)
      save('sleeps', rec)
    })().catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

function SleepView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sleeps = useStore(s => s.sleeps)
  const profile = useStore(s => s.healthProfile)
  const save = useStore(s => s.save)
  const [perm, setPerm] = useState<boolean | null>(null)
  const r = useMemo(() => [...sleeps].sort((a, b) => b.wake - a.wake)[0], [sleeps])
  const week = lastNDaysSafe(7, dateKey())
  useEffect(() => { if (open && sleepAvailable()) sleepPermission().then(setPerm) }, [open])
  const rate = (v: number) => { if (!r) return; const n = { ...r, rested: v }; n.score = sleepScore(n, profile.sleepGoalMin); save('sleeps', n) }
  const recalc = async () => {
    const today = dateKey()
    const from = parseKey(addDays(today, -1)).getTime() + (21 * 60 + 30) * 60e3
    const to = Math.min(Date.now(), parseKey(today).getTime() + 12 * 3600e3)
    const d = detectSleep(await screenEvents(from, to), from, to, true)
    if (!d) { alert('No sleep detected yet for last night.'); return }
    const existing = sleeps.find(x => x.date === today)
    const rec: SleepRecord = { id: existing?.id ?? uid(), date: today, ...d, rested: existing?.rested, score: 0, source: 'auto' }
    rec.score = sleepScore(rec, profile.sleepGoalMin); save('sleeps', rec)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Sleep">
      <div className="space-y-3.5 pb-2">
        {!sleepAvailable() && (
          <div className="rounded-2xl border border-[#8FB8FF]/35 bg-[#8FB8FF]/10 p-3.5 text-sm space-y-1">
            <div className="font-bold flex items-center gap-2"><Smartphone size={16} /> How sleep tracking works</div>
            <div className="text-xs text-ink-2 leading-relaxed">After 9 PM tap <b className="text-ink">Good night</b> on Today when you put the phone down. In the morning, the first time you open Kairo becomes your wake-up, and a quick check-in (times pre-filled, editable) saves the night with a score. If you forget the tap, Kairo uses your last use of the app after 9:30 PM.</div>
          </div>
        )}
        {sleepAvailable() && perm === false && (
          <div className="rounded-2xl border border-warning/35 bg-warning/10 p-3.5 space-y-2">
            <div className="text-sm font-bold text-warning">Allow “Usage access” for Kairo</div>
            <div className="text-xs text-ink-2">Android needs this once so Kairo can see when your screen was on or off. The data never leaves your phone.</div>
            <Pill variant="lavender" className="h-9 text-xs" onClick={() => openUsageAccess()}>Open settings</Pill>
          </div>
        )}
        <div className="relative mx-auto w-fit">
          <div className="absolute -inset-8 rounded-full anim-breathe" style={{ background: 'radial-gradient(circle,#8fb8ff40,transparent 65%)' }} />
          <ScoreRing value={r?.score ?? 0} size={200} big empty={!r} label={r ? `SLEEP SCORE · ${sleepLabel(r.score).toUpperCase()}` : 'NO DATA YET'} />
        </div>
        {r && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[[fmtDur(r.asleepMin), 'asleep'], [fmtTime(r.sleepStart), 'phone down'], [String(r.wakeUps), 'wake-ups']].map(([v, l]) => (
                <div key={l} className="glass rounded-2xl py-2.5"><b className="text-[16px] text-ink">{v}</b><div className="text-[10px] text-ink-2 font-semibold">{l}</div></div>
              ))}
            </div>
            {r.timeline && <NightChart r={r} />}
            <div className="glass rounded-[20px] p-3.5">
              <b className="text-[13px]">How rested do you feel?</b>
              <div className="flex gap-1.5 mt-2">{RESTED.map(([e, l], i) => (
                <motion.button key={l} whileTap={{ scale: 0.88 }} onClick={() => rate(i + 1)} className={`flex-1 rounded-[14px] py-2 border ${r.rested === i + 1 ? 'bg-[#8fb8ff]/18 border-[#8fb8ff]/60' : 'border-transparent'}`}>
                  <div className="text-lg">{e}</div><div className={`text-[9px] font-bold ${r.rested === i + 1 ? 'text-[#8FB8FF]' : 'text-ink-3'}`}>{l}</div>
                </motion.button>
              ))}</div>
            </div>
          </>
        )}
        {sleeps.length > 0 && (
          <div className="glass rounded-[20px] p-3.5">
            <b className="text-[13px]">Last 7 nights</b>
            <div className="mt-2"><MiniBars data={week.map(d => ({ label: weekdayShort(d)[0], value: sleeps.find(x => x.date === d)?.asleepMin ?? 0, highlight: d === dateKey() }))} color="#8FB8FF" format={v => fmtDur(v)} /></div>
          </div>
        )}
        {sleepAvailable() && perm && <Pill className="w-full" onClick={recalc}><RefreshCw size={15} /> Re-check last night</Pill>}
        <div className="text-[10px] text-ink-3 text-center flex items-center justify-center gap-1"><Moon size={11} /> Score = duration vs goal · wake-ups · bedtime regularity · how rested you feel</div>
      </div>
    </Sheet>
  )
}

function NightChart({ r }: { r: SleepRecord }) {
  const start = r.sleepStart - 30 * 60e3, end = r.wake + 30 * 60e3
  const segs = (r.timeline ?? []).filter(s => s.end > start && s.start < end)
  const buckets = 24
  const step = (end - start) / buckets
  const bars = Array.from({ length: buckets }, (_, i) => {
    const a = start + i * step, b = a + step
    const used = segs.filter(s => s.type === 'used').reduce((acc, s) => acc + Math.max(0, Math.min(b, s.end) - Math.max(a, s.start)), 0)
    const inSleep = a >= r.sleepStart && b <= r.wake
    return used > step * 0.2 ? 'used' : inSleep ? (i > 2 && i < buckets - 3 ? 'deep' : 'idle') : 'idle'
  })
  return (
    <div className="glass rounded-[20px] p-3.5">
      <div className="flex justify-between mb-2"><b className="text-[13px]">Night timeline</b><span className="text-[10px] text-ink-3 font-semibold">from screen activity</span></div>
      <div className="flex items-end gap-[2px] h-20">
        {bars.map((t, i) => (
          <motion.i key={i} className="flex-1 rounded-t-[3px] origin-bottom" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.1 + i * 0.025, duration: 0.5 }}
            style={{ height: t === 'used' ? '30%' : t === 'deep' ? '95%' : '70%', background: t === 'used' ? '#FFCF7A' : t === 'deep' ? '#6E8BEA' : '#8FB8FF' }} />
        ))}
      </div>
      <div className="flex justify-between text-[9.5px] text-ink-3 font-bold mt-1"><span>{fmtTime(start)}</span><span>{fmtTime(end)}</span></div>
      <div className="flex gap-3 text-[10px] text-ink-2 font-semibold mt-2"><span><span className="text-[#6E8BEA]">■</span> Deep idle</span><span><span className="text-[#8FB8FF]">■</span> Idle</span><span><span className="text-warning">■</span> Phone used</span></div>
    </div>
  )
}

