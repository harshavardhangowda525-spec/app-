import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Expand, Minimize, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Field, Pill, Section, Sheet, spring } from '../components/ui'
import { useDay, useNow, useReducedMotion } from '../lib/hooks'
import { dateKey, fmtDur, pad } from '../lib/time'
import type { Category, FocusSession } from '../lib/types'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { streak } from '../lib/analytics'

const PRESETS = [25, 45, 60, 120]
const DIAL = 300, C = DIAL / 2, ARC_R = 126, ORB = 200
const ZONE = 168 // equal top/bottom zone height → dial sits at the exact screen centre

function lerpColor(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const A = p(a), B = p(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}

/** 60 minute ticks; lit ticks shade peach→lavender. Memoised on lit count to avoid 60 re-renders per second. */
const TickDial = memo(function TickDial({ lit, dim }: { lit: number; dim?: boolean }) {
  return (
    <g>
      {Array.from({ length: 60 }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 60
        const major = i % 5 === 0
        const ro = C - 2, ri = C - (major ? 16 : 10)
        const on = i < lit
        return (
          <line key={i} x1={C + Math.cos(a) * ri} y1={C + Math.sin(a) * ri} x2={C + Math.cos(a) * ro} y2={C + Math.sin(a) * ro}
            stroke={on ? lerpColor('#FFC4AE', '#C9B8FF', i / Math.max(1, lit)) : '#fff'}
            strokeOpacity={on ? (dim ? 0.45 : 1) : major ? 0.22 : 0.1} strokeWidth={major ? 2.4 : 1.6} strokeLinecap="round"
            style={{ transition: 'stroke-opacity .4s, stroke .4s' }} />
        )
      })}
    </g>
  )
})

function wavePath(width: number, period: number, amp: number) {
  let d = `M0 ${amp}`
  for (let x = 0; x <= width; x += 4) d += ` L${x} ${(amp + Math.sin((x / period) * 2 * Math.PI) * amp).toFixed(1)}`
  return `${d} L${width} 400 L0 400 Z`
}
const FRONT = wavePath(400, 100, 12)
const BACK = wavePath(400, 200, 14)

const PARTICLES = [
  [46, 150, 3, 0.7, 7, 0], [312, 170, 2, 0.5, 9, 1.2], [330, 300, 3, 0.35, 8, 2.5], [28, 330, 2, 0.45, 10, 0.6], [60, 470, 3, 0.6, 7.5, 3.1],
  [300, 460, 2, 0.7, 8.5, 1.8], [250, 128, 2, 0.4, 9.5, 4], [96, 120, 2, 0.35, 6.5, 2.2], [340, 400, 2, 0.3, 11, 0.3], [20, 240, 2, 0.3, 9, 5],
  [150, 470, 2, 0.45, 8, 3.6], [205, 105, 2, 0.5, 10, 1],
] as const

type Phase = 'ready' | 'running' | 'paused' | 'complete'

export default function Focus() {
  const reduced = useReducedMotion()
  const active = useStore(s => s.activeFocus)
  const sessions = useStore(s => s.focusSessions)
  const { startFocus, pauseFocus, resumeFocus, finishFocus, complete, addDistraction } = useStore()
  const { focusDraft, setTab } = useNav()
  const now = useNow(active && !active.pausedAt ? 1000 : 30000)
  const today = dateKey(now)
  const { items } = useDay(today, now)

  const suggested = useMemo(() => {
    const cur = items.find(i => i.status === 'active' && i.focusMinutes) ?? items.find(i => i.status === 'upcoming' && i.focusMinutes)
    return cur ? { label: cur.title, category: cur.category, minutes: cur.focusMinutes!, instanceKey: cur.key } : null
  }, [items])

  const [draft, setDraft] = useState<{ label: string; category: Category; minutes: number; instanceKey?: string }>(
    () => focusDraft ?? suggested ?? { label: 'Free focus', category: 'Other', minutes: 25 })
  useEffect(() => { if (focusDraft) setDraft(focusDraft) }, [focusDraft])
  const [done, setDone] = useState<FocusSession | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [fs, setFs] = useState(false)

  const phase: Phase = done ? 'complete' : active ? (active.pausedAt ? 'paused' : 'running') : 'ready'
  const planned = active?.plannedMinutes ?? done?.plannedMinutes ?? draft.minutes
  const elapsedMs = active ? (active.pausedAt ?? now.getTime()) - active.startedAt - active.pausedTotalMs : done ? done.actualMinutes * 60000 : 0
  const totalMs = planned * 60000
  const frac = phase === 'complete' ? 1 : Math.min(1, Math.max(0, elapsedMs / totalMs))
  const remaining = Math.max(0, totalMs - elapsedMs)
  const label = active?.label ?? done?.label ?? draft.label

  // auto-complete when the planned duration is reached
  useEffect(() => {
    if (phase === 'running' && remaining <= 0) {
      const s = finishFocus(true)
      if (s) { setDone(s); navigator.vibrate?.([80, 60, 160]) }
    }
  }, [phase, remaining, finishFocus])

  // milestone haptic
  const quarter = Math.floor(frac * 4)
  const lastQ = useRef(quarter)
  useEffect(() => {
    if (phase === 'running' && quarter > lastQ.current && quarter < 4) navigator.vibrate?.(40)
    lastQ.current = quarter
  }, [quarter, phase])

  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {})

  const streakDays = useMemo(() => streak(d => sessions.some(s => s.date === d)), [sessions])
  const todayMin = sessions.filter(s => s.date === today).reduce((a, s) => a + s.actualMinutes, 0)
  const linkedItem = (active?.instanceKey ?? done?.instanceKey) ? items.find(i => i.key === (active?.instanceKey ?? done?.instanceKey)) : undefined

  const start = () => startFocus({ plannedMinutes: draft.minutes, label: draft.label, category: draft.category, instanceKey: draft.instanceKey })
  const finishNow = () => { const s = finishFocus(true); if (s) setDone(s) }
  const cancel = () => { if (window.confirm('Discard this session without saving?')) finishFocus(false) }

  const minuteIdx = Math.min(planned, Math.floor(elapsedMs / 60000) + 1)
  const litTicks = phase === 'ready' ? 0 : Math.round(frac * 60)
  const endsAt = active && !active.pausedAt ? new Date(now.getTime() + remaining) : null
  const liquidDark = frac > 0.55
  const calm = phase === 'paused'
  const immersive = phase === 'running' || phase === 'paused'
  const midRef = useRef<HTMLDivElement>(null)
  const dialScale = useFitScale(midRef)

  const chips = (phase === 'ready'
    ? [draft.instanceKey ? 'Linked to schedule' : 'Unlinked session', `Today ${fmtDur(todayMin)}`]
    : phase === 'paused' ? [`Paused ${fmtDur((now.getTime() - (active?.pausedAt ?? now.getTime())) / 60000)}`, 'Progress saved']
      : phase === 'complete' ? [`+${done?.actualMinutes ?? 0} min ${done?.category ?? ''}`, `Streak ${streakDays} day${streakDays === 1 ? '' : 's'}`]
        : [endsAt ? `Ends ${endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '', `Streak ${streakDays} day${streakDays === 1 ? '' : 's'}`, `Today ${fmtDur(todayMin + elapsedMs / 60000)}`]
  ).filter(Boolean)

  // Layout: [top zone][dial][bottom zone]. Both zones have the SAME fixed height, so the dial is
  // always at the exact centre of the screen and scales to whatever space is left between them.
  return (
    <>
    <div className={`relative -mx-4 px-4 flex flex-col overflow-hidden ${calm || reduced ? 'paused-anim' : ''} ${reduced ? 'reduce-motion' : ''}`}
      style={{ minHeight: immersive ? 'calc(100dvh - max(12px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom)))' : 'calc(100dvh - max(12px, env(safe-area-inset-top)) - max(14px, env(safe-area-inset-bottom)) - 74px)' }}>
      {/* Particles */}
      <div className="pointer-events-none absolute inset-0" style={{ opacity: phase === 'ready' ? 0.55 : calm ? 0.25 : 1, transition: 'opacity .6s' }}>
        {PARTICLES.map(([x, y, r, o, d, delay], i) => (
          <span key={i} className="absolute rounded-full anim-drift"
            style={{
              left: `${(x / 360) * 100}%`, top: y, width: r * (phase === 'complete' ? 3.2 : 2), height: r * (phase === 'complete' ? 3.2 : 2),
              background: i % 3 ? '#FFC4AE' : '#C9B8FF', boxShadow: '0 0 6px rgba(255,180,160,.8)',
              ['--o' as string]: o, ['--d' as string]: `${d}s`, ['--delay' as string]: `${delay}s`,
            }} />
        ))}
      </div>

      {/* Top zone: header + status chips */}
      <div className="relative flex-none flex flex-col gap-3" style={{ height: ZONE }}>
      <div className="relative flex items-center justify-between pt-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTab('today')} aria-label="Minimise" className="glass grid place-items-center size-9 rounded-full"><ChevronDown size={16} /></motion.button>
        <button className="text-center" onClick={() => phase === 'ready' && setPickOpen(true)}>
          <div className="text-[10px] font-bold tracking-[.18em] text-ink-3">{phase === 'ready' ? 'FOCUS' : 'DEEP FOCUS'}</div>
          <div className="flex items-center justify-center gap-1.5 text-sm font-bold max-w-[220px]">
            <span className={`size-1.5 rounded-full bg-peach shrink-0 ${phase === 'running' ? 'shadow-[0_0_6px_#FFB59A]' : 'opacity-40'}`} />
            <span className="truncate">{label}</span>
            {phase === 'ready' && <ChevronDown size={14} className="text-ink-3 shrink-0" />}
          </div>
        </button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={toggleFs} aria-label="Toggle fullscreen" className="glass grid place-items-center size-9 rounded-full">
          {fs ? <Minimize size={15} /> : <Expand size={15} />}
        </motion.button>
      </div>
      <div className="flex justify-center gap-2 flex-wrap">
        {chips.map(t => <span key={t} className="glass rounded-full px-3 py-1.5 text-[11px] font-semibold text-ink-2 whitespace-nowrap">{t}</span>)}
      </div>
      {phase === 'complete' && linkedItem && linkedItem.status !== 'done' && (
        <Pill variant="white" className="w-full h-11 text-[13px]" onClick={() => { complete(linkedItem); setDone(null) }}>
          <Check size={16} /> <span className="truncate">Mark “{linkedItem.title}” done</span>
        </Pill>
      )}
      </div>

      {/* Middle zone: the dial, centred and scaled to fit */}
      <div ref={midRef} className="relative flex-1 min-h-0">
      {/* absolute so the 300px dial never stretches the layout; scale fits it to the zone */}
      <div className="absolute left-1/2 top-1/2" style={{ width: DIAL, height: DIAL, transform: `translate(-50%, -50%) scale(${dialScale})`, transition: 'transform .45s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="absolute anim-breathe rounded-full pointer-events-none"
          style={{
            inset: phase === 'complete' ? -80 : -50, opacity: phase === 'ready' ? 0.7 : calm ? 0.25 : 1, transition: 'opacity .6s, inset .8s',
            background: phase === 'complete'
              ? 'radial-gradient(circle, rgba(201,184,255,.45), rgba(255,158,158,.18) 50%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255,153,140,.34), rgba(184,115,255,.16) 45%, transparent 70%)',
          }} />
        {phase === 'complete' && !reduced && [0, 0.6, 1.2].map(d => (
          <span key={d} className="absolute inset-0 rounded-full border-[1.5px] border-lavender/50 anim-ring-out" style={{ animationDelay: `${d}s` }} />
        ))}
        <svg width={DIAL} height={DIAL} className="absolute inset-0 overflow-visible">
          <defs>
            <linearGradient id="arcG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFC4AE" /><stop offset=".6" stopColor="#FF9EA8" /><stop offset="1" stopColor="#C9B8FF" />
            </linearGradient>
            <radialGradient id="halo"><stop offset="0" stopColor="#FFD9CC" stopOpacity=".85" /><stop offset="1" stopColor="#FF9A9A" stopOpacity="0" /></radialGradient>
          </defs>
          <TickDial lit={litTicks} dim={calm} />
          <circle cx={C} cy={C} r={ARC_R} fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth="3" />
          <circle cx={C} cy={C} r={ARC_R} fill="none" stroke="url(#arcG)" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * ARC_R} strokeDashoffset={2 * Math.PI * ARC_R * (1 - frac)}
            transform={`rotate(-90 ${C} ${C})`} opacity={phase === 'ready' ? 0 : calm ? 0.35 : 1}
            style={{ transition: 'stroke-dashoffset 1s linear, opacity .5s', filter: 'drop-shadow(0 0 6px rgba(255,140,150,.6))' }} />
          {/* comet */}
          <g style={{ transform: `rotate(${frac * 360}deg)`, transformOrigin: `${C}px ${C}px`, transition: phase === 'running' ? 'transform 1s linear' : 'transform .8s cubic-bezier(.2,.8,.2,1)' }}>
            <circle cx={C} cy={C - ARC_R} r="15" fill="url(#halo)" className={phase === 'running' ? 'anim-heartbeat' : ''} style={{ transformOrigin: `${C}px ${C - ARC_R}px`, opacity: calm ? 0 : 1 }} />
            <circle cx={C} cy={C - ARC_R} r="5" fill="#fff" opacity={calm ? 0.4 : 1} style={{ filter: 'drop-shadow(0 0 6px #FFC0B4)' }} />
          </g>
        </svg>

        {/* Liquid orb */}
        <div className="absolute rounded-full overflow-hidden"
          style={{
            width: ORB, height: ORB, left: C - ORB / 2, top: C - ORB / 2,
            background: 'linear-gradient(180deg,#2a1f45,#120f1f)', border: '1px solid rgb(255 255 255 / .1)',
            boxShadow: 'inset 0 2px 18px rgba(204,184,255,.18)',
          }}>
          <div className="absolute inset-x-0 h-[110%]" style={{ top: `${(1 - Math.max(0.03, frac)) * 100 - 3.5}%`, transition: 'top 1.2s cubic-bezier(.3,1.4,.5,1)', opacity: calm ? 0.55 : 1 }}>
            <div className="absolute top-0 left-0 h-full w-[200%] anim-waveR" style={{ marginTop: -4 }}>
              <svg viewBox="0 0 400 400" preserveAspectRatio="none" className="w-full h-full">
                <defs><linearGradient id="wb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C9B8FF" stopOpacity=".6" /><stop offset="1" stopColor="#8C6BF2" stopOpacity=".35" /></linearGradient></defs>
                <path d={BACK} fill="url(#wb)" />
              </svg>
            </div>
            <div className="absolute top-0 left-0 h-full w-[200%] anim-waveL">
              <svg viewBox="0 0 400 400" preserveAspectRatio="none" className="w-full h-full">
                <defs><linearGradient id="wf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFC8A8" /><stop offset=".5" stopColor="#FF9EA6" /><stop offset="1" stopColor="#E66E9C" /></linearGradient></defs>
                <path d={FRONT} fill="url(#wf)" />
              </svg>
            </div>
          </div>
          <div className="absolute left-6 top-3 w-[120px] h-[60px] rounded-full rotate-[18deg]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.14), transparent)' }} />
        </div>

        {/* Readout */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center -mt-2">
            <div className={`text-[10px] font-bold tracking-[.16em] ${phase === 'paused' ? 'text-warning' : liquidDark ? 'text-on-peach' : 'text-lavender'}`}>
              {phase === 'ready' ? `READY · ${planned} MIN` : phase === 'paused' ? 'PAUSED' : phase === 'complete' ? 'SESSION COMPLETE' : `MINUTE ${minuteIdx} / ${planned}`}
            </div>
            <Digits text={phase === 'complete' ? `${done?.actualMinutes ?? planned}:00` : fmtTimer(phase === 'ready' ? totalMs : remaining)}
              className={phase === 'paused' ? 'anim-pulse-soft' : ''} />
            <div className={`text-[11px] font-semibold ${liquidDark ? 'text-on-peach/70' : 'text-white/60'}`}>
              {phase === 'ready' ? 'tap play to begin' : phase === 'paused' ? 'tap play to resume' : phase === 'complete' ? `minutes of ${done?.category === 'Education' ? 'deep study' : 'deep focus'}` : 'remaining'}
            </div>
          </div>
        </div>
      </div>

      </div>

      {/* Bottom zone: presets / milestones + controls (same height as top zone) */}
      <div className="relative flex-none flex flex-col justify-end gap-3 pb-1" style={{ height: ZONE }}>
        {phase === 'ready' ? (
          <div className="flex justify-center gap-1.5">
            {PRESETS.map(m => (
              <motion.button key={m} whileTap={{ scale: 0.92 }} onClick={() => setDraft(d => ({ ...d, minutes: m }))}
                className={`h-9 px-3 rounded-full text-[13px] font-bold ${draft.minutes === m ? 'peach-grad text-white shadow-[0_6px_16px_rgba(255,140,150,.45)]' : 'glass text-ink-2'}`}>{m}m</motion.button>
            ))}
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setCustomOpen(true)}
              className={`h-9 px-3 rounded-full text-[13px] font-bold ${!PRESETS.includes(draft.minutes) ? 'peach-grad text-white' : 'glass text-ink-2'}`}>
              {!PRESETS.includes(draft.minutes) ? `${draft.minutes}m` : 'Custom'}
            </motion.button>
          </div>
        ) : (
          <div className="px-4 space-y-2">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map(q => {
                const f = Math.min(1, Math.max(0, frac * 4 - q))
                return (
                  <div key={q} className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className={`h-full rounded-full ${phase === 'complete' ? 'lav-grad' : 'peach-grad'}`}
                      style={{ width: `${f * 100}%`, transition: 'width 1s linear', boxShadow: f ? '0 0 6px rgba(255,140,150,.6)' : undefined }} />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[11px] font-semibold">
              {[1, 2, 3, 4].map(q => {
                const passed = frac * 4 >= q
                return <span key={q} className={passed ? (q > 2 && phase === 'complete' ? 'text-lavender font-bold' : 'text-peach font-bold') : 'text-ink-3'}>
                  {Math.round((planned * q) / 4)}{q === 4 ? ' min' : ''}{passed ? ' ✓' : ''}</span>
              })}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          {phase !== 'complete' && (
            <motion.button whileTap={{ scale: 0.9 }} disabled={phase === 'ready'} onClick={cancel} aria-label="Discard session"
              className="glass grid place-items-center size-[50px] rounded-full disabled:opacity-35"><RotateCcw size={20} className="text-ink-2" /></motion.button>
          )}
          <div className="relative size-[88px] grid place-items-center">
            <span className={`pointer-events-none absolute inset-0 rounded-full ${phase === 'running' ? 'anim-spin-slow' : ''}`}
              style={{ padding: 2, background: 'conic-gradient(#FFC4AE, #C9B8FF, #FFC4AE)', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))', opacity: calm ? 0.3 : 1 }} />
            <motion.button whileTap={{ scale: 0.9 }} transition={spring} aria-label={phase === 'running' ? 'Pause' : phase === 'complete' ? 'Done' : 'Start'}
              onClick={() => phase === 'ready' ? start() : phase === 'running' ? pauseFocus() : phase === 'paused' ? resumeFocus() : setDone(null)}
              className={`size-[76px] rounded-full grid place-items-center shadow-[0_10px_30px_rgba(255,150,150,.45)] ${phase === 'complete' ? 'bg-lavender' : 'bg-white'}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={phase} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.18 }}>
                  {phase === 'running' ? <Pause size={26} fill="#2A1420" color="#2A1420" /> : phase === 'complete' ? <Check size={28} strokeWidth={2.6} color="#1B1430" /> : <Play size={26} fill="#2A1420" color="#2A1420" className="ml-1" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
          {phase !== 'complete' && <HoldToFinish disabled={phase === 'ready'} onFinish={finishNow} />}
        </div>

        <div className="text-center text-[11px] font-medium text-ink-3 h-4">
          {phase === 'ready' ? (draft.instanceKey ? 'Suggested for your scheduled block · never forced' : 'Pick a task above, or just focus')
            : phase === 'complete' ? `Logged to ${done?.category === 'Education' ? 'Study Tracker' : 'Focus history'}`
              : <button onClick={() => { addDistraction(); navigator.vibrate?.(15) }} className="text-[11px] font-bold text-ink-2 underline decoration-dotted">Got distracted? Tap · {active?.distractions ?? 0} so far · hold ✓ to finish</button>}
        </div>

      </div>
    </div>

      {phase === 'ready' && <History sessions={sessions} />}

      <Sheet open={customOpen} onClose={() => setCustomOpen(false)} title="Custom duration">
        <CustomMinutes initial={draft.minutes} onSave={m => { setDraft(d => ({ ...d, minutes: m })); setCustomOpen(false) }} />
      </Sheet>
      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Focus on…">
        <div className="space-y-2">
          <button className="w-full glass rounded-2xl p-3 text-left text-sm font-semibold" onClick={() => { setDraft(d => ({ ...d, label: 'Free focus', category: 'Other', instanceKey: undefined })); setPickOpen(false) }}>Free focus (no task)</button>
          {items.filter(i => i.end && (i.status === 'active' || i.status === 'upcoming' || i.status === 'overdue')).map(i => (
            <button key={i.key} className="w-full glass rounded-2xl p-3 text-left" onClick={() => {
              setDraft({ label: i.title, category: i.category, minutes: i.focusMinutes ?? Math.min(120, i.endMin - i.startMin), instanceKey: i.key }); setPickOpen(false)
            }}>
              <div className="text-sm font-semibold">{i.title}</div>
              <div className="text-xs text-ink-3">{i.category} · {fmtDur(i.focusMinutes ?? i.endMin - i.startMin)}</div>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

/** Scale the dial to fit the middle zone (keeps it centred, never overlapping the controls). */
function useFitScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [s, setS] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const { width, height } = el.getBoundingClientRect()
      const avail = Math.min(width - 12, height - 20)
      setS(Math.max(0.55, Math.min(1.25, avail / DIAL)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return s
}

function fmtTimer(ms: number) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}

/** Odometer-style digits: only the changed character rolls. */
function Digits({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`flex justify-center font-extrabold text-white tracking-[-0.04em] leading-none my-1 tabular-nums ${className}`}
      style={{ fontSize: text.length > 5 ? 44 : 52, textShadow: '0 4px 12px rgba(90,30,60,.25)' }}>
      {text.split('').map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden" style={{ width: ch === ':' ? '0.32em' : '0.62em', height: '1.1em' }}>
          <AnimatePresence initial={false}>
            <motion.span key={ch} className="absolute inset-0 grid place-items-center"
              initial={{ y: '-60%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '60%', opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </div>
  )
}

function HoldToFinish({ onFinish, disabled }: { onFinish: () => void; disabled?: boolean }) {
  const [holding, setHolding] = useState(false)
  const t = useRef<number>()
  const startHold = () => {
    if (disabled) return
    setHolding(true)
    t.current = window.setTimeout(() => { setHolding(false); navigator.vibrate?.(30); onFinish() }, 900)
  }
  const stop = () => { setHolding(false); clearTimeout(t.current) }
  return (
    <button aria-label="Hold to finish" disabled={disabled} onPointerDown={startHold} onPointerUp={stop} onPointerLeave={stop} onContextMenu={e => e.preventDefault()}
      className="relative glass grid place-items-center size-[54px] rounded-full disabled:opacity-35 select-none touch-none">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 54 54">
        <circle cx="27" cy="27" r="25" fill="none" stroke="#C9B8FF" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={157}
          style={{ strokeDashoffset: holding ? 0 : 157, transition: holding ? 'stroke-dashoffset .9s linear' : 'stroke-dashoffset .2s' }} />
      </svg>
      <Check size={20} className="text-lavender" />
    </button>
  )
}

function CustomMinutes({ initial, onSave }: { initial: number; onSave: (m: number) => void }) {
  const [v, setV] = useState(String(initial))
  const n = Math.round(Number(v))
  return (
    <div className="space-y-3">
      <Field label="Minutes (1–240)"><input type="number" inputMode="numeric" min={1} max={240} className="field" value={v} onChange={e => setV(e.target.value)} /></Field>
      <Pill variant="lavender" className="w-full h-12" disabled={!(n >= 1 && n <= 240)} onClick={() => onSave(n)}>Set {n || 0} minutes</Pill>
    </div>
  )
}

function History({ sessions }: { sessions: FocusSession[] }) {
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 8)
  return (
    <Section title="Session history" className="pt-4">
      {recent.length === 0 ? (
        <div className="glass rounded-[20px] p-4 text-sm text-ink-3 flex items-center gap-2"><Timer size={16} /> No sessions yet — your first one starts the streak.</div>
      ) : (
        <div className="space-y-2">
          {recent.map(s => (
            <div key={s.id} className="glass rounded-[18px] px-3.5 py-3 flex items-center gap-3">
              <div className={`size-2 rounded-full ${s.completed ? 'bg-lavender' : 'bg-ink-3'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{s.label}</div>
                <div className="text-xs text-ink-3">{new Date(s.startedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>
              </div>
              <div className="text-sm font-bold">{fmtDur(s.actualMinutes)}<span className="text-ink-3 font-medium">/{fmtDur(s.plannedMinutes)}</span></div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
