import { motion } from 'framer-motion'
import { Flame, Phone, Target } from 'lucide-react'
import { useMemo } from 'react'
import { followUpsDue } from '../lib/insightsPlus'
import { addDays, dateKey, prettyDate } from '../lib/time'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { Pill, Ring, Section } from './ui'

/** Daily outreach target (calls + DMs) with rings and a streak of days the target was hit. */
export function OutreachTarget() {
  const today = dateKey()
  const sales = useStore(s => s.sales)
  const t2 = useStore(s => s.targets2)
  const bump = useStore(s => s.bumpSales)
  const update = useStore(s => s.updateTargets2)
  const day = sales[today] ?? { calls: 0, dms: 0 }
  const hit = (d: string) => { const s = sales[d]; return !!s && s.calls >= t2.outreachCalls && s.dms >= t2.outreachDms }
  const streak = useMemo(() => { let n = 0, d = hit(today) ? today : addDays(today, -1); while (hit(d) && n < 999) { n++; d = addDays(d, -1) } return n },
    [sales, t2]) // eslint-disable-line react-hooks/exhaustive-deps
  const wd = new Date().getDay()
  if (wd === 0 || wd === 6) return null // weekends have no outreach block
  return (
    <Section title="Outreach target" right={<button className="text-xs font-semibold text-lavender" onClick={() => {
      const c = Number(window.prompt('Daily cold calls target', String(t2.outreachCalls))), d = Number(window.prompt('Daily Instagram DMs target', String(t2.outreachDms)))
      if (c >= 0 && d >= 0) update({ outreachCalls: Math.round(c), outreachDms: Math.round(d) })
    }}>Edit</button>}>
      <div className="glass rounded-[22px] p-4 flex items-center gap-4">
        {([['calls', 'Calls', day.calls, t2.outreachCalls, '#FFB59A'], ['dms', 'DMs', day.dms, t2.outreachDms, '#C9B8FF']] as const).map(([k, l, v, goal, c]) => (
          <div key={k} className="flex flex-col items-center gap-1">
            <Ring pct={goal ? (v / goal) * 100 : 0} size={58} stroke={5} color={c}><span className="text-sm font-extrabold">{v}</span></Ring>
            <span className="text-[10px] text-ink-3 font-semibold">{l} / {goal}</span>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => { bump(today, k, 1); navigator.vibrate?.(10) }} className="h-6 px-2.5 rounded-full text-[11px] font-bold" style={{ background: `${c}26`, color: c }}>+1</motion.button>
          </div>
        ))}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-1 text-lg font-extrabold"><Flame size={18} className={streak ? 'text-peach' : 'text-ink-3'} />{streak}</div>
          <div className="text-[10px] text-ink-3">day streak</div>
          {day.calls >= t2.outreachCalls && day.dms >= t2.outreachDms
            ? <div className="text-[11px] font-bold text-success mt-1 flex items-center justify-end gap-1"><Target size={12} /> Target hit</div>
            : <div className="text-[11px] text-ink-2 mt-1">{Math.max(0, t2.outreachCalls - day.calls)} calls · {Math.max(0, t2.outreachDms - day.dms)} DMs to go</div>}
        </div>
      </div>
    </Section>
  )
}

/** CRM follow-ups due today become actionable items on Today. */
export function FollowUpsToday() {
  const data = useStore()
  const save = useStore(s => s.save)
  const setTab = useNav(s => s.setTab)
  const due = followUpsDue(data)
  if (!due.length) return null
  const today = dateKey()
  return (
    <Section title={`Follow-ups due · ${due.length}`} right={<button className="text-xs font-semibold text-lavender" onClick={() => setTab('business')}>CRM</button>}>
      <div className="space-y-2">
        {due.slice(0, 4).map(l => (
          <div key={l.id} className="glass rounded-[18px] px-3.5 py-2.5 flex items-center gap-3">
            <Phone size={16} className="text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{l.businessName}</div>
              <div className={`text-[11px] ${l.nextFollowUp! < today ? 'text-warning' : 'text-ink-3'}`}>{l.stage} · {l.nextFollowUp! < today ? `overdue since ${prettyDate(l.nextFollowUp!)}` : 'today'}</div>
            </div>
            {l.phone && <a href={`tel:${l.phone}`} className="glass h-8 px-3 rounded-full text-[11px] font-bold grid place-items-center">Call</a>}
            <Pill className="h-8 text-[11px]" onClick={() => save('leads', { ...l, lastContact: today, nextFollowUp: addDays(today, 3), updatedAt: Date.now() })}>Contacted</Pill>
          </div>
        ))}
      </div>
    </Section>
  )
}
