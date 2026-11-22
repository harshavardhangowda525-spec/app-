import { AnimatePresence, motion } from 'framer-motion'
import { Check, Timer, AlertCircle, ArrowRightLeft } from 'lucide-react'
import { useState } from 'react'
import type { ActivityInstance } from '../lib/types'
import { fmtDur, fmtRange } from '../lib/time'
import { CatIcon, spring } from './ui'
import { useStore } from '../store/useStore'

export function TaskRow({ item, onClick }: { item: ActivityInstance; onClick?: () => void }) {
  const done = item.status === 'done'
  const skipped = item.status === 'skipped'
  const overdue = item.status === 'overdue'
  const moved = item.status === 'moved'
  const meta = `${fmtRange(item.start, item.end)}${item.end ? ` · ${fmtDur(item.endMin - item.startMin)}` : ''}`
  return (
    <motion.button
      layoutId={`task-${item.key}`}
      layout="position"
      transition={spring}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left glass rounded-[18px] px-3.5 py-3 flex items-center gap-3 ${done || skipped || moved ? 'opacity-65' : ''}`}
    >
      <div className="grid place-items-center size-9 rounded-xl bg-white/8 shrink-0"><CatIcon c={item.category} /></div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold truncate ${done ? 'line-through text-ink-2' : skipped || moved ? 'text-ink-2' : ''}`}>{item.title}</div>
        <div className={`text-xs font-medium truncate ${overdue ? 'text-warning' : 'text-ink-3'}`}>
          {overdue ? `Missed · ${meta}` : skipped ? `Skipped · ${meta}` : moved ? `Moved to ${item.completion?.movedTo}` : meta}
          {item.rescheduled && !overdue && <span className="text-lavender"> · moved</span>}
        </div>
      </div>
      <StatusDot status={item.status} />
    </motion.button>
  )
}

function StatusDot({ status }: { status: ActivityInstance['status'] }) {
  if (status === 'done') return (
    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="grid place-items-center size-[22px] rounded-full bg-lavender">
      <Check size={13} strokeWidth={3} color="#1B1430" />
    </motion.span>
  )
  if (status === 'overdue') return <AlertCircle size={20} className="text-warning" />
  if (status === 'moved') return <ArrowRightLeft size={18} className="text-ink-3" />
  if (status === 'skipped') return <span className="size-[22px] rounded-full border-[1.5px] border-white/15 grid place-items-center text-[10px] text-ink-3">–</span>
  return <span className="size-[22px] rounded-full border-[1.5px] border-white/12" />
}

export function ActiveCard({ item, now, onDone, onSkip, onFocus, onMore, onStart, startedAt }: {
  item: ActivityInstance; now: Date; onDone: () => void; onSkip: () => void; onFocus?: () => void; onMore: () => void
  onStart?: () => void; startedAt?: number
}) {
  const nowM = now.getHours() * 60 + now.getMinutes()
  const isActive = item.status === 'active'
  const left = item.endMin - nowM
  const startsIn = item.startMin - nowM
  const [checks, setChecks] = useState<Record<number, boolean>>({})
  const [pressing, setPressing] = useState(false)
  const read = useStore(s => s.books.find(b => b.status === 'reading' && (item.id === 'read-pm' ? b.slot === 'evening' : item.id === 'read-am' ? b.slot !== 'evening' : false)))
  const desc = item.module === 'reading' && read ? `${read.title} · p.${read.currentPage}/${read.totalPages}` : item.description

  return (
    <motion.div layoutId={`task-${item.key}`} transition={spring} className="peach-card rounded-[28px] p-5 pb-[18px] text-white relative overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isActive && <span className="relative size-1.5"><span className="absolute inset-0 rounded-full bg-white" /><span className="absolute inset-0 rounded-full bg-white anim-heartbeat" /></span>}
            <span className="text-[11px] font-bold tracking-[.1em] uppercase text-on-peach/70 truncate">
              {item.category}{isActive ? ' · now' : ' · up next'}
            </span>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} onClick={onSkip}
            className="h-8 px-3.5 rounded-full text-xs font-bold bg-white/22 border border-white/35 shrink-0">Skip</motion.button>
        </div>
        <button onClick={onMore} className="block text-left w-full">
          <h2 className="text-[26px] leading-[30px] font-extrabold tracking-[-0.03em]">{item.title}</h2>
          {desc && <p className="mt-1.5 text-sm font-medium text-white/80">{desc}</p>}
        </button>
        {item.checklist && item.checklist.length > 0 && (
          <div className="space-y-2">
            {item.checklist.map((c, i) => (
              <button key={i} onClick={() => setChecks(s => ({ ...s, [i]: !s[i] }))} className="flex items-center gap-2.5 text-sm font-semibold w-full text-left">
                <span className={`grid place-items-center size-[18px] rounded-md border-[1.5px] ${checks[i] ? 'bg-white border-white' : 'border-white/75'}`}>
                  {checks[i] && <Check size={12} strokeWidth={3.2} color="#E8798F" />}
                </span>
                <span className={checks[i] ? 'line-through text-white/70 font-medium' : ''}>{c}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end justify-between gap-3 pt-0.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-on-peach/70 whitespace-nowrap truncate">{fmtRange(item.start, item.end)}{item.end ? ` · ${fmtDur(item.endMin - item.startMin)}` : ''}</div>
            <div className="text-[17px] font-extrabold whitespace-nowrap">
              {isActive ? (item.end ? `${fmtDur(left)} left` : 'Now') : startsIn > 0 ? `In ${fmtDur(startsIn)}` : 'Ready'}
            </div>
            {startedAt ? <div className="text-[10px] font-bold text-on-peach/60">Started {new Date(startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
              : onStart && isActive && item.end && <button onClick={onStart} className="mt-1 h-6 px-2.5 rounded-full text-[10px] font-bold bg-white/22 border border-white/35">▶ Start</button>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onFocus && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={onFocus} aria-label="Start focus session"
                className="grid place-items-center size-12 rounded-full bg-white/22 border border-white/35"><Timer size={20} /></motion.button>
            )}
            <motion.button
              onPointerDown={() => setPressing(true)} onPointerUp={() => setPressing(false)} onPointerLeave={() => setPressing(false)}
              animate={{ scale: pressing ? 0.94 : 1 }} transition={spring} onClick={onDone}
              className="h-12 px-7 rounded-full bg-white text-on-peach text-[15px] font-bold shadow-[0_8px_20px_rgba(107,31,51,0.28)]">
              Done
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function CompletionOverlay({ title, detail, done, eligible, pct, next, onContinue, onClose, reduced, onEnergy }: {
  title: string; detail?: string; done: number; eligible: number; pct: number; next?: ActivityInstance
  onContinue: () => void; onClose: () => void; reduced: boolean; onEnergy?: (lvl: 1 | 2 | 3) => void
}) {
  const [energy, setEnergy] = useState<1 | 2 | 3 | null>(null)
  return (
    <AnimatePresence>
      <motion.div key="overlay" className="fixed inset-0 z-[60] grid place-items-center px-6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
        <motion.div className="absolute inset-0 bg-[#05050c]/75" onClick={onClose} />
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
          className="relative w-full max-w-[320px] rounded-[32px] px-6 pt-8 pb-6 text-center overflow-hidden"
          style={{
            background: 'linear-gradient(180deg,#2B1F4D,#16112B)',
            boxShadow: '0 0 48px rgba(140,107,255,.35), 0 24px 48px rgba(0,0,0,.5)',
          }}
        >
          {/* animated luminous border */}
          <div className="pointer-events-none absolute inset-0 rounded-[32px] p-[1.5px] overflow-hidden"
            style={{ WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }}>
            <div className="absolute -inset-[60%] anim-spin-slow" style={{ background: 'conic-gradient(from 0deg, #C9B8FFee, #C9B8FF22, #FFB59Acc, #C9B8FF22, #C9B8FFee)' }} />
          </div>
          <div className="relative mx-auto size-[132px] grid place-items-center">
            {!reduced && [0, 0.5, 1].map(d => (
              <span key={d} className="absolute inset-[22px] rounded-full border-[1.5px] border-lavender/50 anim-ring-out" style={{ animationDelay: `${d}s` }} />
            ))}
            {[132, 108, 86].map((s, i) => (
              <motion.span key={s} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 + i * 0.08, ...spring }}
                className="absolute rounded-full border-[1.5px]" style={{ width: s, height: s, borderColor: `rgba(201,184,255,${[0.1, 0.18, 0.3][i]})` }} />
            ))}
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.2 }}
              className="relative size-16 rounded-full grid place-items-center"
              style={{ background: 'radial-gradient(circle,#ECE4FF,#B39BFF)', boxShadow: '0 0 28px 2px rgba(190,165,255,.8)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1B1430" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M20 6 9 17l-5-5" initial={{ pathLength: 0 } as never} animate={{ pathLength: 1 } as never} transition={{ delay: 0.4, duration: 0.45, ease: 'easeOut' }} />
              </svg>
            </motion.div>
          </div>
          <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="mt-3 text-2xl font-extrabold tracking-tight">One step forward.</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-1.5 text-[13px] font-medium text-lavender">
            {title} · {detail ?? 'completed'}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="mt-4 glass rounded-[18px] p-3.5 text-left space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-semibold">{done} of {eligible} done today</span>
              <span className="text-[15px] font-extrabold text-lavender">{pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
              <motion.div className="h-full rounded-full lav-grad" initial={{ width: `${Math.max(0, pct - 8)}%` }} animate={{ width: `${pct}%` }} transition={{ delay: 0.85, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
            </div>
            {next && <div className="text-xs"><span className="text-ink-3">Next: </span><span className="font-semibold text-ink-2">{next.title}</span></div>}
          </motion.div>
          {onEnergy && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-3">
              <div className="text-[11px] text-ink-3 mb-1.5">Energy right now?</div>
              <div className="flex gap-1.5">{([[1, '🪫 Low'], [2, '🙂 OK'], [3, '⚡ High']] as const).map(([lv, l]) => (
                <button key={lv} onClick={() => { if (!energy) { setEnergy(lv); onEnergy(lv) } }}
                  className={`flex-1 h-8 rounded-full text-[11px] font-bold border ${energy === lv ? 'bg-lavender text-purple-deep border-lavender' : 'border-white/15 text-ink-2'} ${energy && energy !== lv ? 'opacity-40' : ''}`}>{l}</button>
              ))}</div>
            </motion.div>
          )}
          <motion.button whileTap={{ scale: 0.96 }} onClick={onContinue}
            className="mt-4 w-full h-12 rounded-full bg-lavender text-purple-deep text-sm font-bold">
            {next ? 'Continue to next task' : 'Wrap up the day'}
          </motion.button>
          <button onClick={onClose} className="mt-3 text-[13px] font-semibold text-ink-2">Close</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
