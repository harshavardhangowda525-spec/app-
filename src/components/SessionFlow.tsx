import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronLeft, Minus, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { EXERCISES, MUSCLES, MUSCLE_LABEL, PRESETS, exImg, libFor, type LibExercise, type Muscle } from '../data/exerciseLib'
import { personalRecords } from '../lib/insightsPlus'
import { addDays, dateKey, prettyDate, uid } from '../lib/time'
import type { Workout } from '../lib/types'
import { useStore } from '../store/useStore'

/* ---------------- draft (survives app close mid-workout) ---------------- */
interface DSet { kg: number; reps: number; done: boolean }
interface DEx { exId?: string; name: string; muscle: Muscle; sets: DSet[] }
export interface SessionDraft { startedAt: number; muscles: Muscle[]; picked: DEx[]; step: Step; idx: number }
type Step = 'muscles' | 'pick' | 'log' | 'summary'
const DRAFT_KEY = 'kairo-session-draft'
export const loadDraft = (): SessionDraft | null => { try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null } catch { return null } }
const saveDraft = (d: SessionDraft | null) => { try { d ? localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : localStorage.removeItem(DRAFT_KEY) } catch { /* storage blocked */ } }

const e1rm = (s: { kg: number; reps: number }) => Math.round(s.kg * (1 + s.reps / 30) * 10) / 10
const keyOf = (n: string) => n.trim().toLowerCase()

function Photo({ id, className = '', delay = 0, still }: { id?: string; className?: string; delay?: number; still?: boolean }) {
  if (!id) return <div className={`xf grid place-items-center text-xl ${className}`}>🏋️</div>
  return (
    <div className={`xf ${className}`} style={{ ['--xd' as string]: `${delay}s` }}>
      <img src={exImg(id, still ? 1 : 0)} alt="" loading="lazy" decoding="async" />
      {!still && <img src={exImg(id, 1)} alt="" loading="lazy" decoding="async" />}
    </div>
  )
}

export default function SessionFlow({ resume, onClose }: { resume?: SessionDraft | null; onClose: () => void }) {
  const workouts = useStore(s => s.workouts)
  const saveW = useStore(s => s.save)
  const data = useStore()
  const reduce = useReducedMotion()
  const [d, setD] = useState<SessionDraft>(() => resume ?? { startedAt: Date.now(), muscles: [], picked: [], step: 'muscles', idx: 0 })
  useEffect(() => { if (d.step !== 'muscles' || d.picked.length) saveDraft(d) }, [d])
  const up = (p: Partial<SessionDraft>) => setD(x => ({ ...x, ...p }))

  // History lookups
  const lastByName = useMemo(() => {
    const m = new Map<string, { date: string; sets: { kg: number; reps: number }[] }>()
    for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt))
      for (const e of w.exercises) if (e.sets.length) m.set(keyOf(e.name), { date: w.date, sets: e.sets })
    return m
  }, [workouts])
  const lastTrained = useMemo(() => {
    const m = new Map<Muscle, string>()
    for (const w of workouts) {
      const ms = new Set<string>([...(w.muscles ?? []), ...w.exercises.map(e => e.muscle ?? libFor(e)?.muscle).filter(Boolean) as string[]])
      for (const k of ms) { const cur = m.get(k as Muscle); if (!cur || w.date > cur) m.set(k as Muscle, w.date) }
    }
    return m
  }, [workouts])
  const prs = useMemo(() => personalRecords(data), [data])

  const close = () => { if (d.picked.some(p => p.sets.some(s => s.done)) && d.step !== 'summary' && !confirm('Leave this session? It stays saved as a draft you can resume.')) return; onClose() }
  const discard = () => { if (confirm('Discard this session?')) { saveDraft(null); onClose() } }

  return createPortal(
    <motion.div className="fixed inset-0 z-[56] bg-[#0A0A12] overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ background: 'radial-gradient(120% 50% at 50% -5%,#3a1f4a80,transparent 60%),#0A0A12' }}>
      <div className="mx-auto max-w-[480px] h-full relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={d.step + (d.step === 'log' ? d.idx : '')} className="absolute inset-0"
            initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
            {d.step === 'muscles' && <MusclesStep d={d} up={up} lastTrained={lastTrained} onClose={close} />}
            {d.step === 'pick' && <PickStep d={d} up={up} lastByName={lastByName} />}
            {d.step === 'log' && <LogStep d={d} up={up} lastByName={lastByName} prs={prs} onDiscard={discard} />}
            {d.step === 'summary' && <SummaryStep d={d} up={up} prs={prs} onSave={(w) => { saveW('workouts', w); saveDraft(null); navigator.vibrate?.([30, 50, 30]); onClose() }} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body,
  )
}

/* ---------------- 1 · muscles ---------------- */
function ago(date?: string) {
  if (!date) return 'never'
  const today = dateKey()
  if (date === today) return 'today'
  if (date === addDays(today, -1)) return 'yesterday'
  const n = Math.round((new Date(today).getTime() - new Date(date).getTime()) / 864e5)
  return n < 14 ? `${n} days ago` : prettyDate(date)
}

function MusclesStep({ d, up, lastTrained, onClose }: { d: SessionDraft; up: (p: Partial<SessionDraft>) => void; lastTrained: Map<Muscle, string>; onClose: () => void }) {
  const sel = new Set(d.muscles)
  const toggle = (m: Muscle) => { navigator.vibrate?.(12); up({ muscles: sel.has(m) ? d.muscles.filter(x => x !== m) : [...d.muscles, m] }) }
  const preset = PRESETS.find(p => p.muscles.length === sel.size && p.muscles.every(m => sel.has(m)))
  return (
    <div className="h-full flex flex-col px-4 pt-[max(18px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between">
        <div><div className="label !text-ink-3 !text-[10px]">New session · {prettyDate(dateKey())}</div><div className="text-[22px] font-extrabold tracking-tight">What are you training?</div></div>
        <button onClick={onClose} aria-label="Close" className="size-9 rounded-full glass grid place-items-center"><X size={16} /></button>
      </div>
      <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => { navigator.vibrate?.(12); up({ muscles: [...p.muscles] }) }}
            className={`shrink-0 h-8 px-3.5 rounded-full text-[11px] font-extrabold ${preset?.label === p.label ? 'bg-white text-on-peach' : 'bg-white/[.06] text-ink-2'}`}>{p.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 flex-1 content-start overflow-y-auto no-scrollbar pb-2">
        {MUSCLES.map((m, i) => {
          const on = sel.has(m.key)
          return (
            <motion.button key={m.key} onClick={() => toggle(m.key)} whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`relative aspect-[1/1.12] rounded-[18px] overflow-hidden border ${on ? 'glow-border border-transparent' : 'border-white/10'}`}>
              <img src={exImg(m.cover, 1)} alt="" loading="lazy" className={`absolute inset-0 size-full object-cover transition-[filter] duration-300 ${on ? '' : 'saturate-[.35] brightness-[.65]'}`} />
              <div className="absolute inset-0" style={{ background: on ? 'linear-gradient(180deg,#ff8fa81f,transparent 35%,#07060cee 92%)' : 'linear-gradient(180deg,transparent 35%,#07060cee 92%)' }} />
              <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="absolute top-1.5 right-1.5 z-[3] size-[18px] rounded-full bg-success text-[#0a2a1c] grid place-items-center"><Check size={11} strokeWidth={3.5} /></motion.span>}</AnimatePresence>
              <div className="absolute inset-x-0 bottom-1.5 text-center leading-tight">
                <div className="text-[12px] font-extrabold">{m.label}</div>
                <div className="text-[9px] font-bold text-ink-3">{ago(lastTrained.get(m.key))}</div>
              </div>
            </motion.button>
          )
        })}
      </div>
      <div className="pt-2">
        <div className="text-[11px] text-ink-2 text-center mb-2 h-4">{sel.size ? <>{d.muscles.map(m => MUSCLE_LABEL[m]).join(' · ')}{preset && <> — <b className="text-peach">{preset.label} day</b></>}</> : 'Pick one or more muscles'}</div>
        <motion.button whileTap={{ scale: 0.97 }} disabled={!sel.size} onClick={() => up({ step: 'pick' })}
          className="w-full h-12 rounded-full font-extrabold text-[#1B1430] disabled:opacity-40 shadow-[0_10px_24px_rgba(255,140,140,.35)]" style={{ background: 'linear-gradient(90deg,#FFC79E,#EE789E)' }}>Choose exercises →</motion.button>
      </div>
    </div>
  )
}

/* ---------------- 2 · pick exercises ---------------- */
function PickStep({ d, up, lastByName }: { d: SessionDraft; up: (p: Partial<SessionDraft>) => void; lastByName: Map<string, { sets: { kg: number; reps: number }[] }> }) {
  const [tab, setTab] = useState<Muscle>(d.muscles[0])
  const [q, setQ] = useState('')
  const picked = new Set(d.picked.map(p => p.exId ?? keyOf(p.name)))
  const query = q.trim().toLowerCase()
  const list = query
    ? EXERCISES.filter(e => d.muscles.includes(e.muscle) && e.name.toLowerCase().includes(query)).concat(EXERCISES.filter(e => !d.muscles.includes(e.muscle) && e.name.toLowerCase().includes(query))).slice(0, 40)
    : EXERCISES.filter(e => e.muscle === tab)
  const lastFor = (n: string) => { const l = lastByName.get(keyOf(n)); if (!l) return null; const top = [...l.sets].sort((a, b) => e1rm(b) - e1rm(a))[0]; return top }
  const newEx = (e: LibExercise): DEx => {
    const l = lastByName.get(keyOf(e.name))
    return { exId: e.id, name: e.name, muscle: e.muscle, sets: l ? l.sets.map(s => ({ kg: s.kg, reps: s.reps, done: false })) : [0, 1, 2].map(() => ({ kg: 0, reps: 10, done: false })) }
  }
  const toggle = (e: LibExercise) => {
    navigator.vibrate?.(12)
    up({ picked: picked.has(e.id) ? d.picked.filter(p => p.exId !== e.id) : [...d.picked, newEx(e)] })
  }
  const addCustom = () => {
    const name = q.trim(); if (!name) return
    const l = lastByName.get(keyOf(name))
    up({ picked: [...d.picked, { name, muscle: tab, sets: l ? l.sets.map(s => ({ ...s, done: false })) : [0, 1, 2].map(() => ({ kg: 0, reps: 10, done: false })) }] }); setQ('')
  }
  const exact = query && EXERCISES.some(e => e.name.toLowerCase() === query)
  const nextMuscles = d.muscles.filter(m => m !== tab && !d.picked.some(p => p.muscle === m))
  return (
    <div className="h-full flex flex-col px-4 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <button onClick={() => up({ step: 'muscles' })} aria-label="Back" className="size-9 rounded-full glass grid place-items-center"><ChevronLeft size={18} /></button>
        <div><div className="label !text-ink-3 !text-[10px]">{d.muscles.map(m => MUSCLE_LABEL[m]).join(' · ')}</div><div className="text-[20px] font-extrabold tracking-tight leading-tight">Pick exercises</div></div>
      </div>
      <label className="mt-3 h-10 rounded-full bg-white/[.06] border border-white/10 flex items-center gap-2 px-3.5">
        <Search size={15} className="text-ink-3" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search “chest press”…" className="bg-transparent outline-none flex-1 text-[13px]" />
        {q && <button onClick={() => setQ('')} aria-label="Clear"><X size={14} className="text-ink-3" /></button>}
      </label>
      {!query && (
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar -mx-4 px-4">
          {d.muscles.map(m => {
            const n = d.picked.filter(p => p.muscle === m).length
            return <button key={m} onClick={() => setTab(m)} className={`shrink-0 h-8 px-3.5 rounded-full text-[11px] font-extrabold ${tab === m ? 'text-[#2a1420]' : 'bg-white/[.06] text-ink-2'}`}
              style={tab === m ? { background: 'linear-gradient(90deg,#FFB59A,#FF8FA8)' } : undefined}>{MUSCLE_LABEL[m]}{n ? ` · ${n}` : ''}</button>
          })}
        </div>
      )}
      <div className="flex-1 overflow-y-auto no-scrollbar mt-2.5 pb-28 space-y-1.5">
        {query && !exact && (
          <button onClick={addCustom} className="w-full rounded-[16px] border border-dashed border-lavender/40 p-3 text-left text-[12.5px] font-bold text-lavender">+ Add “{q.trim()}” as a custom {MUSCLE_LABEL[tab].toLowerCase()} exercise</button>
        )}
        {list.map((e, i) => {
          const on = picked.has(e.id)
          const last = lastFor(e.name)
          return (
            <motion.button key={e.id} onClick={() => toggle(e)} whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.035 }}
              className={`w-full flex items-center gap-2.5 p-1.5 pr-2.5 rounded-[16px] border text-left transition-colors ${on ? 'bg-success/[.07] border-success/40' : 'bg-white/[.03] border-white/[.07]'}`}>
              <Photo id={e.id} delay={(i % 4) * 0.35} className="w-[64px] h-[48px] rounded-[12px] shrink-0" />
              <div className="min-w-0 flex-1">
                <b className="text-[12.5px] block leading-tight line-clamp-2">{e.name}</b>
                <span className="text-[10px] font-semibold text-ink-3">{query ? `${MUSCLE_LABEL[e.muscle]} · ` : ''}{last ? `last ${last.kg} kg × ${last.reps}` : e.equipment}</span>
              </div>
              <motion.span key={on ? 'y' : 'n'} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 16 }}
                className={`size-[28px] shrink-0 rounded-full grid place-items-center ${on ? 'bg-success text-[#0a2a1c]' : 'bg-lavender/15 text-lavender'}`}>{on ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}</motion.span>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {d.picked.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="absolute left-3 right-3 bottom-[max(14px,env(safe-area-inset-bottom))] rounded-[22px] p-2.5 pl-3 flex items-center gap-2.5 bg-[#1d1a30]/95 border border-lavender/25 backdrop-blur">
            <div className="flex -space-x-2">{d.picked.slice(-3).map((p, i) => <Photo key={i} id={p.exId} still className="size-7 rounded-full border-2 border-[#1d1a30]" />)}</div>
            <div className="flex-1 min-w-0"><b className="text-[12.5px]">{d.picked.length} selected</b>
              <div className="text-[10px] text-ink-2 truncate">{nextMuscles.length ? `+ ${nextMuscles.map(m => MUSCLE_LABEL[m].toLowerCase()).join(' & ')} next` : 'Ready to go'}</div></div>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => up({ step: 'log', idx: 0 })} className="h-9 px-4 rounded-full font-extrabold text-[12.5px] text-[#1B1430]" style={{ background: 'linear-gradient(90deg,#FFC79E,#EE789E)' }}>Start →</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------------- 3 · log sets ---------------- */
function Stepper({ value, step, onChange, dim }: { value: number; step: number; onChange: (v: number) => void; dim?: boolean }) {
  return (
    <div className={`h-9 rounded-[12px] bg-white/[.06] border border-white/10 flex items-center justify-between ${dim ? 'opacity-60' : ''}`}>
      <button onClick={() => onChange(Math.max(0, Math.round((value - step) * 10) / 10))} className="w-8 h-full grid place-items-center text-ink-3" aria-label="Decrease"><Minus size={14} /></button>
      <input type="number" inputMode="decimal" value={value || ''} placeholder="0" onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-0 flex-1 bg-transparent text-center font-extrabold text-[15px] outline-none" />
      <button onClick={() => onChange(Math.round((value + step) * 10) / 10)} className="w-8 h-full grid place-items-center text-ink-3" aria-label="Increase"><Plus size={14} /></button>
    </div>
  )
}

function LogStep({ d, up, lastByName, prs, onDiscard }: { d: SessionDraft; up: (p: Partial<SessionDraft>) => void; lastByName: Map<string, { sets: { kg: number; reps: number }[] }>; prs: Map<string, { e1rm: number }>; onDiscard: () => void }) {
  const ex = d.picked[d.idx]
  if (!ex) return null
  const lib = libFor(ex)
  const setEx = (p: Partial<DEx>) => up({ picked: d.picked.map((x, i) => (i === d.idx ? { ...x, ...p } : x)) })
  const setSet = (k: number, p: Partial<DSet>) => setEx({ sets: ex.sets.map((s, i) => (i === k ? { ...s, ...p } : s)) })
  const prevBest = prs.get(keyOf(ex.name))?.e1rm ?? 0
  const best = Math.max(0, ...ex.sets.filter(s => s.done && s.kg && s.reps).map(e1rm))
  const isPR = prevBest > 0 && best > prevBest
  const prSet = isPR ? ex.sets.filter(s => s.done).sort((a, b) => e1rm(b) - e1rm(a))[0] : null
  const last = lastByName.get(keyOf(ex.name))
  const lastIdx = d.picked.length - 1
  const secondary: Record<string, string> = { chest: 'Chest · front delts · triceps', back: 'Lats · mid back · biceps', shoulders: 'Delts · traps', biceps: 'Biceps · forearms', triceps: 'Triceps', legs: 'Quads · hamstrings · calves', abs: 'Core', glutes: 'Glutes · hamstrings', forearms: 'Forearms · grip' }
  return (
    <div className="h-full flex flex-col px-4 pt-[max(18px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex items-start gap-2">
        <button onClick={() => up({ step: 'pick' })} aria-label="Back to exercises" className="size-9 shrink-0 rounded-full glass grid place-items-center"><ChevronLeft size={18} /></button>
        <div className="flex-1 min-w-0"><div className="label !text-ink-3 !text-[10px]">Exercise {d.idx + 1} of {d.picked.length}</div><div className="text-[19px] font-extrabold tracking-tight leading-tight line-clamp-2">{ex.name}</div></div>
        <span className="shrink-0 text-[10px] font-extrabold text-success bg-success/10 px-2.5 py-1.5 rounded-full">{d.idx + 1} / {d.picked.length}</span>
      </div>
      <div className="flex gap-1 mt-2.5">{d.picked.map((p, i) => (
        <button key={i} onClick={() => up({ idx: i })} aria-label={`Go to ${p.name}`} className="flex-1 h-[5px] rounded-full" style={{ background: i === d.idx ? '#FFB59A' : p.sets.some(s => s.done) ? '#9BE7C4aa' : '#ffffff18' }} />
      ))}</div>
      <div className="flex-1 overflow-y-auto no-scrollbar pb-3 -mx-1 px-1">
        <div className="relative mt-3 h-[180px] rounded-[22px] overflow-hidden border border-white/10">
          <div className="absolute inset-0"><Photo id={lib?.id ?? ex.exId} className="size-full" /></div>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,#07060c77,transparent 32%,transparent 62%,#07060cdd)' }} />
          <span className="absolute top-2.5 left-2.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#07060c]/80 border border-pink/40 text-pink">● {secondary[ex.muscle] ?? MUSCLE_LABEL[ex.muscle]}</span>
          <AnimatePresence>{isPR && prSet && (
            <motion.span key="pr" initial={{ scale: 0, rotate: -12 }} animate={{ scale: [0, 1.25, 1], rotate: [-12, 4, -3] }} exit={{ scale: 0 }} transition={{ duration: 0.6 }}
              className="absolute top-2.5 right-2.5 text-[10.5px] font-black px-2.5 py-1 rounded-full text-[#3a2600] shadow-[0_0_24px_#ffcf7aaa]" style={{ background: 'linear-gradient(90deg,#FFE08A,#FFB59A)' }}>🏆 NEW PR · {prSet.kg} kg</motion.span>
          )}</AnimatePresence>
          <div className="absolute bottom-2 inset-x-0 text-center text-[10px] font-bold text-white/85">{lib ? `${lib.equipment} · start ↔ finish position` : 'Custom exercise'}</div>
        </div>
        <div className="mt-3 rounded-[20px] p-3 border border-white/10" style={{ background: 'linear-gradient(160deg,#ffffff0e,#ffffff05)' }}>
          <div className="grid grid-cols-[22px_1fr_1fr_32px] gap-2 text-[10px] font-extrabold text-ink-3 text-center"><span>SET</span><span>KG</span><span>REPS</span><span /></div>
          {ex.sets.map((s, k) => (
            <motion.div key={k} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[22px_1fr_1fr_32px] gap-2 items-center mt-1.5">
              <button onClick={() => ex.sets.length > 1 && setEx({ sets: ex.sets.filter((_, i) => i !== k) })} className="text-[11px] font-extrabold text-ink-3" aria-label={`Remove set ${k + 1}`}>{k + 1}</button>
              <Stepper value={s.kg} step={2.5} onChange={v => setSet(k, { kg: v })} dim={!s.done && k > 0 && !ex.sets[k - 1].done} />
              <Stepper value={s.reps} step={1} onChange={v => setSet(k, { reps: v })} dim={!s.done && k > 0 && !ex.sets[k - 1].done} />
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => { navigator.vibrate?.(s.done ? 8 : 20); setSet(k, { done: !s.done }) }} aria-label={s.done ? 'Mark set not done' : 'Mark set done'}
                className={`size-8 rounded-[10px] grid place-items-center ${s.done ? 'bg-success text-[#0a2a1c]' : 'bg-white/[.06] text-ink-3'}`}>
                <motion.span key={String(s.done)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}><Check size={15} strokeWidth={3} /></motion.span>
              </motion.button>
            </motion.div>
          ))}
          {last && <div className="text-[10px] text-ink-3 font-bold text-center mt-2">last time: {last.sets.map(s => `${s.kg}×${s.reps}`).join(' · ')}</div>}
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => setEx({ sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] ?? { kg: 0, reps: 10 }), done: false }] })} className="flex-1 h-9 rounded-full glass text-[11.5px] font-extrabold">+ Set</button>
            <button onClick={() => { const src = [...ex.sets].reverse().find(s => s.done) ?? ex.sets[ex.sets.length - 1]; const k = ex.sets.findIndex(s => !s.done); if (src && k >= 0) setSet(k, { kg: src.kg, reps: src.reps, done: true }); navigator.vibrate?.(20) }}
              className="flex-1 h-9 rounded-full glass text-[11.5px] font-extrabold">Copy last set ✓</button>
          </div>
        </div>
        <div className="flex justify-between mt-3 px-1">
          <button onClick={() => { const rest = d.picked.filter((_, i) => i !== d.idx); if (!rest.length) { up({ picked: rest, step: 'pick' }); return } up({ picked: rest, idx: Math.min(d.idx, rest.length - 1) }) }}
            className="text-[11px] font-bold text-ink-3 flex items-center gap-1"><Trash2 size={12} /> Remove exercise</button>
          <button onClick={onDiscard} className="text-[11px] font-bold text-danger/80">Discard session</button>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button disabled={d.idx === 0} onClick={() => up({ idx: d.idx - 1 })} className="flex-1 h-12 rounded-full glass font-extrabold text-[13px] disabled:opacity-35">← Prev</button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => up(d.idx < lastIdx ? { idx: d.idx + 1 } : { step: 'summary' })}
          className="flex-[1.5] h-12 rounded-full font-extrabold text-[13px] text-[#1B1430] truncate px-3" style={{ background: 'linear-gradient(90deg,#FFC79E,#EE789E)' }}>
          {d.idx < lastIdx ? `Next: ${d.picked[d.idx + 1].name.split(' ').slice(0, 3).join(' ')} →` : 'Finish session ✓'}
        </motion.button>
      </div>
    </div>
  )
}

/* ---------------- 4 · summary ---------------- */
function CountUp({ to, dur = 1.6 }: { to: number; dur?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / (dur * 1000)); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [to, dur])
  return <>{v.toLocaleString('en-IN')}</>
}

function SummaryStep({ d, up, prs, onSave }: { d: SessionDraft; up: (p: Partial<SessionDraft>) => void; prs: Map<string, { e1rm: number }>; onSave: (w: Workout) => void }) {
  const workouts = useStore(s => s.workouts)
  const done = d.picked.map(p => ({ ...p, sets: p.sets.filter(s => s.done && s.reps > 0) })).filter(p => p.sets.length)
  const volume = Math.round(done.flatMap(p => p.sets).reduce((a, s) => a + s.kg * s.reps, 0))
  const sets = done.reduce((a, p) => a + p.sets.length, 0)
  const mins = Math.max(1, Math.round((Date.now() - d.startedAt) / 60000))
  const preset = PRESETS.find(p => p.muscles.length === d.muscles.length && p.muscles.every(m => d.muscles.includes(m)))
  const title = preset ? `${preset.label} day` : d.muscles.map(m => MUSCLE_LABEL[m]).join(' + ')
  const prev = [...workouts].filter(w => w.title === title).sort((a, b) => b.date.localeCompare(a.date))[0]
  const prevVol = prev ? prev.exercises.flatMap(e => e.sets).reduce((a, s) => a + s.kg * s.reps, 0) : 0
  const delta = prevVol ? Math.round(((volume - prevVol) / prevVol) * 100) : null
  const byMuscle = d.muscles.map(m => ({ m, n: done.filter(p => p.muscle === m).reduce((a, p) => a + p.sets.length, 0) })).filter(x => x.n)
  const newPRs = done.map(p => { const b = p.sets.reduce((x, s) => (e1rm(s) > e1rm(x) ? s : x), p.sets[0]); const old = prs.get(keyOf(p.name))?.e1rm ?? 0; return old > 0 && e1rm(b) > old ? { name: p.name, s: b, e: e1rm(b) } : null }).filter(Boolean) as { name: string; s: DSet; e: number }[]
  const C = 2 * Math.PI * 60
  const fill = prevVol ? Math.min(1, volume / (prevVol * 1.1)) : sets ? 0.85 : 0
  const save = () => onSave({ id: uid(), date: dateKey(), title, createdAt: Date.now(), muscles: d.muscles, durationMin: mins,
    exercises: done.map(p => ({ name: p.name, exId: p.exId, muscle: p.muscle, sets: p.sets.map(s => ({ kg: s.kg, reps: s.reps })) })) })
  const chipColor: Record<string, string> = { chest: '#FF8FA8', back: '#8FB8FF', shoulders: '#FFB59A', biceps: '#C9B8FF', triceps: '#FFCF7A', legs: '#9BE7C4', abs: '#FF9ECF', glutes: '#FFB59A', forearms: '#8FB8FF' }
  return (
    <div className="h-full flex flex-col px-4 pt-[max(18px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] text-center">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="label !text-ink-3 !text-[10px]">Session complete</div>
        <div className="text-[22px] font-extrabold tracking-tight">{sets ? `${title} crushed 💪` : 'No sets ticked yet'}</div>
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="relative size-[136px]">
            <svg viewBox="0 0 140 140" className="size-full -rotate-90">
              <defs><linearGradient id="vg"><stop offset="0" stopColor="#FFC79E" /><stop offset="1" stopColor="#EE789E" /></linearGradient></defs>
              <circle cx="70" cy="70" r="60" fill="none" stroke="#ffffff12" strokeWidth="12" />
              <motion.circle cx="70" cy="70" r="60" fill="none" stroke="url(#vg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C}
                initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - fill) }} transition={{ duration: 1.8, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }} />
            </svg>
            <div className="absolute inset-0 grid place-items-center"><div>
              <div className="text-[26px] font-black tracking-[-0.04em]"><CountUp to={volume} /></div>
              <div className="text-[8.5px] font-extrabold text-ink-2 tracking-[.12em]">KG VOLUME</div>
              {delta !== null && <div className={`text-[10px] font-extrabold ${delta >= 0 ? 'text-success' : 'text-warning'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last</div>}
            </div></div>
          </div>
          {done.length > 0 && (
            <div className={`grid gap-1 w-[104px] h-[120px] rounded-[16px] overflow-hidden ${done.length > 1 ? 'grid-cols-2' : ''}`}>
              {done.slice(0, 4).map((p, i) => <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.1 }}><Photo id={p.exId ?? libFor(p)?.id} still className="size-full" /></motion.div>)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[[`${mins}m`, 'DURATION'], [done.length, 'EXERCISES'], [sets, 'SETS']].map(([v, l]) => (
            <div key={l} className="rounded-[14px] py-2 bg-white/[.05] border border-white/10"><b className="block text-[16px] text-ink">{v}</b><span className="text-[9px] text-ink-2 font-bold">{l}</span></div>
          ))}
        </div>
        {byMuscle.length > 0 && (
          <div className="glass rounded-[16px] p-3 mt-2 text-left">
            <div className="label !text-ink-3 !text-[10px] mb-1.5">Muscles hit</div>
            <div className="flex flex-wrap gap-1.5">{byMuscle.map((x, i) => (
              <motion.span key={x.m} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.08 }}
                className="text-[11px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: `${chipColor[x.m]}26`, color: chipColor[x.m] }}>{MUSCLE_LABEL[x.m]} · {x.n} set{x.n > 1 ? 's' : ''}</motion.span>
            ))}</div>
          </div>
        )}
        {newPRs.map(p => (
          <motion.div key={p.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9 }} className="glass rounded-[16px] p-3 mt-2 flex items-center gap-2.5 text-left !border-warning/40">
            <span className="text-2xl">🏆</span><div><b className="text-[12.5px]">New PR</b><div className="text-[11px] text-ink-2">{p.name} {p.s.kg} kg × {p.s.reps} → e1RM {p.e} kg</div></div>
          </motion.div>
        ))}
        {!sets && <div className="text-sm text-ink-3 mt-4">Tick ✓ on the sets you finished, then come back here.</div>}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => up({ step: 'log', idx: Math.max(0, d.picked.length - 1) })} className="flex-1 h-12 rounded-full glass font-extrabold text-[13px]">← Back</button>
        <motion.button whileTap={{ scale: 0.97 }} disabled={!sets} onClick={save} className="flex-[1.6] h-12 rounded-full font-extrabold text-[#1B1430] disabled:opacity-40" style={{ background: 'linear-gradient(90deg,#FFC79E,#EE789E)' }}>Save session</motion.button>
      </div>
    </div>
  )
}
