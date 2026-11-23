import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Number that rolls into place digit by digit, like an odometer. */
export function Odometer({ value, className = '', h = 30 }: { value: number; className?: string; h?: number }) {
  const reduce = useReducedMotion()
  const digits = String(Math.max(0, Math.round(value))).split('')
  return (
    <span className={`inline-flex overflow-hidden tabular-nums ${className}`} style={{ height: h, lineHeight: `${h}px` }} aria-label={String(Math.round(value))}>
      {digits.map((d, i) => (
        <span key={digits.length - i} className="relative inline-block" style={{ height: h }}>
          <motion.span className="flex flex-col" initial={reduce ? false : { y: 0 }} animate={{ y: -Number(d) * h }}
            transition={{ type: 'spring', stiffness: 70, damping: 16, delay: reduce ? 0 : i * 0.08 }}>
            {Array.from({ length: 10 }, (_, n) => <span key={n} style={{ height: h }}>{n}</span>)}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/** Macro ring that sweeps to its fill after `delay`. */
export function MacroRing({ value, goal, color, label, delay = 0 }: { value: number; goal: number; color: string; label: string; delay?: number }) {
  const r = 24, C = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, value / goal) : 0
  return (
    <div className="flex-1 text-center">
      <div className="relative mx-auto size-[60px]">
        <svg viewBox="0 0 60 60" className="size-full -rotate-90">
          <circle cx="30" cy="30" r={r} fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth="6.5" />
          <motion.circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="6.5" strokeLinecap="round" strokeDasharray={C}
            initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct) }} transition={{ duration: 1.3, delay, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ filter: `drop-shadow(0 0 5px ${color}88)` }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-[10px] font-extrabold text-ink-2">{Math.round(pct * 100)}%</div>
      </div>
      <b className="block text-[13px] mt-0.5" style={{ color }}>{Math.round(value)} g</b>
      <span className="text-[9.5px] font-bold text-ink-2 uppercase tracking-wide">{label}</span>
    </div>
  )
}

/** Bulk score as a liquid orb: two wave layers fill up to score/10. */
export function LiquidOrb({ score, size = 58 }: { score: number; size?: number }) {
  const good = score >= 6
  const top = `${100 - Math.max(8, Math.min(100, score * 10)) + 6}%`
  const [a, b] = good ? ['#d6ffe9', '#7fd8ae'] : ['#fff0c8', '#f2c35c']
  return (
    <div className="relative shrink-0 rounded-full overflow-hidden" style={{ width: size, height: size, background: good ? '#0d1f18' : '#221a08', border: `2px solid ${good ? '#9be7c488' : '#ffcf7a88'}`, boxShadow: `0 0 26px ${good ? '#9be7c466' : '#ffcf7a55'}, inset 0 0 14px #000` }}>
      <motion.div className="kai-liq" style={{ background: `radial-gradient(circle at 50% 0, ${a}99, ${b}88 40%)`, borderRadius: '38%', animationDuration: '5s', animationDirection: 'reverse' }}
        initial={{ top: '100%' }} animate={{ top: `calc(${top} - 4%)` }} transition={{ duration: 2, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }} />
      <motion.div className="kai-liq" style={{ background: `radial-gradient(circle at 50% 0, ${a}, ${b} 40%)` }}
        initial={{ top: '100%' }} animate={{ top }} transition={{ duration: 2, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }} />
      <div className="absolute inset-0 grid place-items-center font-black text-[17px] z-[2]" style={{ color: good ? '#0a2a1c' : '#3a2600', textShadow: '0 1px 0 #ffffff66' }}>{score.toFixed(1)}</div>
    </div>
  )
}

/**
 * Logged meal: card morphs into a glowing orb, arcs into the Fuel ring, then a double
 * shockwave + "+N kcal" floats up. `target` is the element the orb lands on.
 */
export function LandingFx({ title, kcal, photo, target, onDone }: { title: string; kcal: number; photo?: string; target: HTMLElement | null; onDone: () => void }) {
  const reduce = useReducedMotion()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [landed, setLanded] = useState(false)
  const done = useRef(onDone); done.current = onDone
  useEffect(() => {
    if (reduce || !target) { done.current(); return }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setRect(target.getBoundingClientRect()), 380)
    return () => clearTimeout(t)
  }, [reduce, target])
  useEffect(() => { if (!landed) return; navigator.vibrate?.([15, 30, 25]); const t = setTimeout(() => done.current(), 1100); return () => clearTimeout(t) }, [landed])
  if (!rect) return null
  const vw = window.innerWidth, vh = window.innerHeight
  const tx = rect.left + rect.width / 2, ty = rect.top + rect.height / 2
  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {!landed && (
        <motion.div className="absolute flex items-center gap-2.5 overflow-hidden"
          style={{ left: 0, top: 0, background: '#ffffff16', border: '1px solid #ffffff26', backdropFilter: 'blur(8px)' }}
          initial={{ x: vw / 2 - 120, y: vh - 150, width: 240, height: 62, borderRadius: 18, opacity: 0 }}
          animate={{
            x: [vw / 2 - 120, vw / 2 - 22, tx - 10], y: [vh - 150, vh - 170, ty - 10],
            width: [240, 44, 20], height: [62, 44, 20], borderRadius: [18, 30, 30], opacity: [1, 1, 1],
            backgroundColor: ['#ffffff16', '#FF8FA8', '#FFC79E'], boxShadow: ['0 0 0 #0000', '0 0 30px #ff8fa8', '0 0 34px #ffc79e'],
          }}
          transition={{ duration: 1.25, times: [0, 0.38, 1], ease: [[0.4, 0, 0.2, 1], [0.6, 0, 0.3, 1]] }}
          onAnimationComplete={() => setLanded(true)}>
          <motion.div className="flex items-center gap-2.5 px-2.5 shrink-0" animate={{ opacity: [1, 0] }} transition={{ duration: 0.35, delay: 0.1 }}>
            <div className="size-10 rounded-xl shrink-0 overflow-hidden grid place-items-center" style={{ background: 'linear-gradient(135deg,#FFD9A0,#E8A55C)' }}>{photo ? <img src={photo} alt="" className="size-full object-cover" /> : '🍽️'}</div>
            <div className="min-w-0"><b className="text-[12.5px] block truncate max-w-[150px]">{title}</b><span className="text-[10.5px] text-ink-2">{Math.round(kcal)} kcal</span></div>
          </motion.div>
        </motion.div>
      )}
      {landed && (
        <>
          {[0, 0.12].map((d, i) => (
            <motion.div key={i} className="absolute rounded-full" style={{ left: tx, top: ty, width: 80, height: 80, marginLeft: -40, marginTop: -40, border: `3px solid ${i ? '#FFC79E' : '#FF8FA8'}` }}
              initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.9, delay: d, ease: 'easeOut' }} />
          ))}
          <motion.div className="absolute text-[15px] font-black text-success" style={{ left: tx, top: ty, translateX: '-50%' }}
            initial={{ y: -10, opacity: 0 }} animate={{ y: -54, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.1 }}>+{Math.round(kcal)} kcal</motion.div>
        </>
      )}
    </div>,
    document.body,
  )
}

/** Live "counting…" number while the AI reads the photo; settles on `final` once known. */
export function ScanCounter({ final }: { final: number | null }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = performance.now(); const from = v
    const tick = (t: number) => {
      const s = (t - t0) / 1000
      if (final == null) setV(Math.round(620 * (1 - Math.exp(-s / 3)) + Math.random() * 12))
      else { const p = Math.min(1, s / 0.7); setV(Math.round(from + (final - from) * (1 - Math.pow(1 - p, 3)))); if (p >= 1) return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final])
  return <span className={final == null ? 'kai-glitch inline-block' : 'inline-block'}>{v}</span>
}
