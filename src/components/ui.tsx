import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen, Briefcase, ChevronLeft, Clapperboard, Code2, Droplet, Dumbbell, FlaskConical, GraduationCap,
  LineChart, Moon, NotebookPen, Sparkles, Circle, X, type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Category } from '../lib/types'
import { useNav } from '../store/nav'

export const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 } as const
export const softSpring = { type: 'spring', stiffness: 220, damping: 26 } as const

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  Personal: Droplet, Reading: BookOpen, Mindset: Sparkles, Education: GraduationCap, Trading: LineChart,
  Fitness: Dumbbell, Development: Code2, Research: FlaskConical, Business: Briefcase, Content: Clapperboard,
  Reflection: NotebookPen, Recovery: Moon, Other: Circle,
}
export const CATEGORY_COLOR: Record<Category, string> = {
  Personal: '#9FD8FF', Reading: '#FFCF7A', Mindset: '#C9B8FF', Education: '#FFB59A', Trading: '#9BE7C4',
  Fitness: '#FF8FA8', Development: '#8FB8FF', Research: '#B7E07A', Business: '#FFB59A', Content: '#FF9ECF',
  Reflection: '#C9B8FF', Recovery: '#8E8CFF', Other: '#9A98AE',
}
export const CATEGORIES = Object.keys(CATEGORY_ICON) as Category[]

export function CatIcon({ c, size = 18, className = '' }: { c: Category; size?: number; className?: string }) {
  const I = CATEGORY_ICON[c] ?? Circle
  return <I size={size} color={CATEGORY_COLOR[c]} strokeWidth={2} className={className} />
}

export function Pill({ children, onClick, variant = 'glass', className = '', disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'white' | 'glass' | 'lavender' | 'peach' | 'ghost' | 'danger'
  className?: string; disabled?: boolean; type?: 'button' | 'submit'
}) {
  const v = {
    white: 'bg-white text-on-peach shadow-[0_8px_20px_rgba(107,31,51,0.28)]',
    glass: 'glass text-ink',
    lavender: 'bg-lavender text-purple-deep',
    peach: 'peach-grad text-on-peach',
    ghost: 'text-ink-2',
    danger: 'bg-danger/15 text-danger border border-danger/30',
  }[variant]
  return (
    <motion.button type={type} whileTap={{ scale: 0.95 }} transition={spring} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 h-10 text-sm font-bold disabled:opacity-40 ${v} ${className}`}>
      {children}
    </motion.button>
  )
}

export function IconBtn({ children, onClick, label, className = '' }: { children: ReactNode; onClick?: () => void; label: string; className?: string }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} transition={spring} aria-label={label} onClick={onClick}
      className={`glass grid place-items-center size-9 rounded-full shrink-0 ${className}`}>{children}</motion.button>
  )
}

export function ScreenHeader({ title, kicker, right, back }: { title: string; kicker?: string; right?: ReactNode; back?: boolean }) {
  const goBack = useNav(s => s.back)
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      {back && <IconBtn label="Back" onClick={goBack}><ChevronLeft size={18} /></IconBtn>}
      <div className="flex-1 min-w-0">
        {kicker && <div className="label !text-ink-3">{kicker}</div>}
        <h1 className="text-[24px] font-bold tracking-tight leading-tight truncate">{title}</h1>
      </div>
      {right}
    </div>
  )
}

export function Section({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between"><span className="label">{title}</span>{right}</div>
      {children}
    </section>
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <div onClick={onClick} className={`glass rounded-[20px] p-4 ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className}`}>{children}</div>
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="glass rounded-[20px] p-6 text-center space-y-2">
      {icon && <div className="mx-auto grid place-items-center size-10 rounded-full glass-strong">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-xs text-ink-2 leading-relaxed">{hint}</div>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="glass rounded-[18px] p-3.5 min-w-0">
      <div className="text-[11px] font-semibold text-ink-2 truncate">{label}</div>
      <div className="text-xl font-extrabold tracking-tight mt-0.5" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-ink-3 mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

export function Bar({ pct, className = '', grad = 'peach-grad' }: { pct: number; className?: string; grad?: string }) {
  return (
    <div className={`h-1 rounded-full bg-white/8 overflow-hidden ${className}`}>
      <motion.div className={`h-full rounded-full ${grad}`} initial={false} animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }} transition={softSpring} />
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  // Portal: page wrappers use transforms, which would trap a fixed sheet under the nav bar.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[480px] max-h-[88dvh] overflow-y-auto no-scrollbar rounded-t-[28px] bg-elevated border-t border-white/10 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">{title}</h2>
              <IconBtn label="Close" onClick={onClose}><X size={16} /></IconBtn>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-semibold text-ink-2">{label}</span>{children}</label>
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="glass rounded-full p-1 flex gap-1 overflow-x-auto no-scrollbar">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} className="relative flex-1 whitespace-nowrap rounded-full px-3 h-8 text-xs font-bold">
          {value === o.v && <motion.span layoutId={`seg-${options.map(x => x.v).join()}`} className="absolute inset-0 rounded-full bg-white/12" transition={spring} />}
          <span className={`relative ${value === o.v ? 'text-ink' : 'text-ink-2'}`}>{o.l}</span>
        </button>
      ))}
    </div>
  )
}

export function Counter({ label, value, onInc, onDec }: { label: string; value: number; onInc: () => void; onDec: () => void }) {
  return (
    <div className="glass rounded-[18px] p-3 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-ink-2 truncate">{label}</div>
        <motion.div key={value} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-xl font-extrabold">{value}</motion.div>
      </div>
      <motion.button whileTap={{ scale: 0.85 }} onClick={onDec} className="size-8 rounded-full glass-strong text-lg font-bold leading-none" aria-label={`Decrease ${label}`}>−</motion.button>
      <motion.button whileTap={{ scale: 0.85 }} onClick={onInc} className="size-8 rounded-full bg-peach text-on-peach text-lg font-bold leading-none" aria-label={`Increase ${label}`}>+</motion.button>
    </div>
  )
}

/** Minimal bar chart (SVG) — values from real records only. */
export function MiniBars({ data, height = 96, color = '#FFB59A', format = (v: number) => String(v) }: {
  data: { label: string; value: number; highlight?: boolean }[]; height?: number; color?: string; format?: (v: number) => string
}) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="flex items-stretch gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <div className="text-[10px] font-semibold text-ink-3 h-3">{d.value ? format(d.value) : ''}</div>
          <div className="w-full flex-1 flex items-end">
            <motion.div className="w-full rounded-md" initial={{ height: 0 }} animate={{ height: `${Math.max(d.value ? 6 : 2, (d.value / max) * 100)}%` }}
              transition={{ ...softSpring, delay: i * 0.03 }}
              style={{ background: d.value ? (d.highlight ? color : `${color}99`) : 'rgb(255 255 255 / 0.08)' }} />
          </div>
          <div className={`text-[10px] font-bold ${d.highlight ? 'text-ink' : 'text-ink-3'}`}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export function Ring({ pct, size = 44, stroke = 4, children, color = '#FFB59A' }: { pct: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - Math.min(1, pct / 100)) }} transition={softSpring} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export const confirmDelete = (what: string) => window.confirm(`Delete ${what}? This cannot be undone.`)
