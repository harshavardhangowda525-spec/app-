import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Bot, Clock3, Minus, Sparkles, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { correlations, energyByHour, planVsReality, weekKey, weekMetrics, type WeekMetrics } from '../lib/insightsPlus'
import { addDays, dateKey, fmt12, fmtDur, prettyDate } from '../lib/time'
import { getXaiKey, providerName } from '../lib/vision'
import { useStore } from '../store/useStore'
import { Card, Field, Pill, Section, Sheet } from './ui'

const Delta = ({ now, prev, unit = '', invert = false }: { now: number | null; prev: number | null; unit?: string; invert?: boolean }) => {
  if (now === null || prev === null) return <span className="text-ink-3 text-[11px]">—</span>
  const d = Math.round((now - prev) * 10) / 10
  const good = invert ? d < 0 : d > 0
  if (d === 0) return <span className="inline-flex items-center text-[11px] text-ink-3"><Minus size={12} />0{unit}</span>
  return <span className={`inline-flex items-center text-[11px] font-bold ${good ? 'text-success' : 'text-danger'}`}>{d > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(d)}{unit}</span>
}

/* ---------------- 1. weekly report ---------------- */

export function WeeklyReport() {
  const data = useStore()
  const today = dateKey()
  const [offset, setOffset] = useState(0)
  const [prioOpen, setPrioOpen] = useState(false)
  const anchor = addDays(today, -7 * offset)
  const cur = useMemo(() => weekMetrics(data, anchor, today), [data, anchor, today])
  const prev = useMemo(() => weekMetrics(data, addDays(anchor, -7), today), [data, anchor, today])
  const empty = cur.eligible === 0 && !data.focusSessions.length
  const row = (label: string, now: number | null, before: number | null, fmt: (v: number) => string, unit = '', invert = false) => (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-ink-2">{label}</span>
      <span className="flex items-center gap-2"><b className="text-sm">{now === null ? '—' : fmt(now)}</b><Delta now={now} prev={before} unit={unit} invert={invert} /></span>
    </div>
  )
  return (
    <Section title="Weekly report" right={
      <div className="flex gap-1">
        <button onClick={() => setOffset(o => o + 1)} className="glass h-7 px-2.5 rounded-full text-[11px] font-bold">‹ Prev</button>
        {offset > 0 && <button onClick={() => setOffset(o => o - 1)} className="glass h-7 px-2.5 rounded-full text-[11px] font-bold">Next ›</button>}
      </div>}>
      <div className="rounded-[22px] p-4 space-y-3" style={{ background: 'linear-gradient(160deg,#241a40,#14112a)', border: '1px solid rgb(201 184 255 / .22)' }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-ink-3 font-semibold">{prettyDate(cur.days[0])} – {prettyDate(cur.days[6])} vs previous week</div>
            <div className="flex items-baseline gap-2"><span className="text-3xl font-extrabold text-lavender">{cur.pct}%</span><Delta now={cur.pct} prev={prev.eligible ? prev.pct : null} unit="%" /></div>
            <div className="text-[11px] text-ink-3">{cur.done} of {cur.eligible} scheduled tasks</div>
          </div>
          {offset === 0 && <Pill variant="lavender" className="h-8 text-[11px]" onClick={() => setPrioOpen(true)}>Plan next week</Pill>}
        </div>
        {empty ? <div className="text-xs text-ink-3">Nothing recorded this week yet.</div> : (
          <>
            <div className="space-y-1.5">
              {Object.entries(cur.byCategory).sort((a, b) => b[1].eligible - a[1].eligible).slice(0, 7).map(([c, v]) => (
                <div key={c} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 text-ink-2 font-semibold truncate">{c}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden"><motion.div className="h-full rounded-full lav-grad" initial={{ width: 0 }} animate={{ width: `${v.pct}%` }} transition={{ duration: 0.8 }} /></div>
                  <span className="w-9 text-right font-bold">{v.pct}%</span>
                  <span className="w-11 text-right"><Delta now={v.pct} prev={prev.byCategory[c]?.eligible ? prev.byCategory[c].pct : null} unit="%" /></span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white/[.03] px-3 py-1">
              {row('Focus time', cur.focusMin, prev.focusMin, v => fmtDur(v), 'm')}
              {row('Avg sleep score', cur.sleepAvg, prev.sleepAvg, v => String(v))}
              {row('Avg calories', cur.kcalAvg, prev.kcalAvg, v => v.toLocaleString('en-IN'))}
              {row('Avg protein', cur.proteinAvg, prev.proteinAvg, v => `${v} g`, 'g')}
              {row('Gym days', cur.gymDays, prev.gymDays, v => String(v))}
              {row('Study days', cur.studyDays, prev.studyDays, v => String(v))}
              {row('Distractions / session', cur.distractionsPerSession, prev.distractionsPerSession, v => String(v), '', true)}
            </div>
            <Funnel f={cur.funnel} />
            <div className="grid grid-cols-2 gap-2">
              <ListBox title="Most missed" items={cur.missed.map(m => `${m.title} · ${m.n}×`)} tone="text-warning" />
              <ListBox title="Most reliable" items={cur.reliable.map(m => `${m.title} · ${m.rate}%`)} tone="text-success" />
            </div>
          </>
        )}
        {offset === 0 && <Coach m={cur} prev={prev} />}
      </div>
      <PrioritiesSheet open={prioOpen} onClose={() => setPrioOpen(false)} />
    </Section>
  )
}

function Funnel({ f }: { f: WeekMetrics['funnel'] }) {
  const steps = [['Touches', f.touches], ['Interested', f.interested], ['Meetings', f.meetings], ['Proposals', f.proposals], ['Won', f.won]] as const
  const max = Math.max(1, f.touches)
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold tracking-widest text-ink-3">SALES FUNNEL</div>
      {steps.map(([l, v], i) => (
        <div key={l} className="flex items-center gap-2 text-[11px]">
          <span className="w-20 text-ink-2 font-semibold">{l}</span>
          <div className="flex-1 h-4 rounded-md bg-white/5 overflow-hidden"><motion.div className="h-full rounded-md" style={{ background: `rgba(255,181,154,${0.9 - i * 0.12})` }} initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.06 }} /></div>
          <span className="w-8 text-right font-bold">{v}</span>
        </div>
      ))}
    </div>
  )
}

const ListBox = ({ title, items, tone }: { title: string; items: string[]; tone: string }) => (
  <div className="rounded-2xl bg-white/[.03] p-2.5">
    <div className={`text-[10px] font-bold tracking-widest ${tone}`}>{title.toUpperCase()}</div>
    {items.length ? items.map(i => <div key={i} className="text-[11px] text-ink-2 truncate mt-1">{i}</div>) : <div className="text-[11px] text-ink-3 mt-1">Not enough data</div>}
  </div>
)

function PrioritiesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = dateKey()
  const nextMonday = addDays(weekKey(today), 7)
  const existing = useStore(s => s.priorities[nextMonday]) ?? []
  const setPriorities = useStore(s => s.setPriorities)
  const [d, setD] = useState<string[]>([0, 1, 2].map(i => existing[i] ?? ''))
  return (
    <Sheet open={open} onClose={onClose} title={`Top 3 for week of ${prettyDate(nextMonday)}`}>
      <div className="space-y-3">
        {d.map((v, i) => <Field key={i} label={`Priority ${i + 1}`}><input className="field" value={v} onChange={e => setD(x => x.map((y, j) => (j === i ? e.target.value : y)))} /></Field>)}
        <p className="text-[11px] text-ink-3">They appear on Monday’s Today screen.</p>
        <Pill variant="lavender" className="w-full h-11" onClick={() => { setPriorities(nextMonday, d.map(x => x.trim())); onClose() }}>Save</Pill>
      </div>
    </Sheet>
  )
}

/* ---------------- AI coach (Groq / Grok text model) ---------------- */

function Coach({ m, prev }: { m: WeekMetrics; prev: WeekMetrics }) {
  const key = weekKey(dateKey())
  const note = useStore(s => s.coachNotes[key])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ask = async () => {
    setBusy(true); setErr('')
    try {
      const summary = { thisWeek: strip(m), lastWeek: strip(prev) }
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ai-key': getXaiKey() }, body: JSON.stringify({ summary }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error || `Coach failed (${r.status})`)
      useStore.setState(s => ({ coachNotes: { ...s.coachNotes, [key]: b.text } }))
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="rounded-2xl border border-lavender/25 bg-lavender/[.06] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-lavender"><Bot size={14} /> AI coach</span>
        <Pill className="h-7 text-[11px]" disabled={busy || !getXaiKey()} onClick={ask}>{busy ? 'Thinking…' : note ? 'Refresh' : 'Get 3 suggestions'}</Pill>
      </div>
      {note ? <div className="text-xs text-ink leading-relaxed whitespace-pre-line">{note}</div>
        : <div className="text-[11px] text-ink-3">{getXaiKey() ? `${providerName()} reads only this week’s summary numbers (no journal text, no photos) and suggests 3 specific changes.` : 'Add your Groq key in Settings to use the coach.'}</div>}
      {err && <div className="text-[11px] text-danger">{err}</div>}
    </div>
  )
}
const strip = (m: WeekMetrics) => ({ completionPct: m.pct, done: m.done, scheduled: m.eligible, byCategory: m.byCategory, focusMin: m.focusMin, sleepAvg: m.sleepAvg, kcalAvg: m.kcalAvg, proteinAvg: m.proteinAvg, gymDays: m.gymDays, studyDays: m.studyDays, funnel: m.funnel, mostMissed: m.missed, mostReliable: m.reliable, distractionsPerSession: m.distractionsPerSession })

/* ---------------- 2. what moves your numbers ---------------- */

export function Correlations() {
  const data = useStore()
  const list = useMemo(() => correlations(data), [data])
  return (
    <Section title="What moves your numbers">
      {list.length ? (
        <div className="space-y-2">
          {list.slice(0, 5).map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-[18px] p-3.5 space-y-2">
              <div className="flex gap-2 text-sm"><Sparkles size={15} className="text-peach shrink-0 mt-0.5" /><span className="leading-snug">{c.text}</span></div>
              <div className="flex items-center gap-2 text-[10px] text-ink-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden"><div className="h-full peach-grad rounded-full" style={{ width: `${Math.min(100, c.a)}%` }} /></div>
                <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden"><div className="h-full bg-white/25 rounded-full" style={{ width: `${Math.min(100, c.b)}%` }} /></div>
                <span>{c.nA}+{c.nB} days</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : <Card className="text-xs text-ink-3">Needs about 2 weeks of logging (sleep, meals, focus, outreach) — then Kairo shows which habits actually lift your days.</Card>}
    </Section>
  )
}

/* ---------------- 5. plan vs reality + energy ---------------- */

export function PlanReality() {
  const data = useStore()
  const rows = useMemo(() => planVsReality(data), [data])
  return (
    <Section title="Plan vs reality">
      {rows.length ? (
        <div className="space-y-2">
          {rows.slice(0, 6).map(r => (
            <div key={r.id} className="glass rounded-[18px] p-3 space-y-1">
              <div className="flex justify-between items-center"><b className="text-sm truncate">{r.title}</b><span className={`text-xs font-bold ${r.onTimePct >= 70 ? 'text-success' : r.onTimePct >= 40 ? 'text-warning' : 'text-danger'}`}>{r.onTimePct}% on time</span></div>
              <div className="text-[11px] text-ink-3"><Clock3 size={11} className="inline -mt-0.5" /> Planned {fmt12(r.scheduled)} · avg {r.avgDelay >= 0 ? `${r.avgDelay} min late` : `${-r.avgDelay} min early`} · {r.n} starts</div>
              {r.suggestion && <div className="text-[11px] text-lavender">{r.suggestion}</div>}
            </div>
          ))}
        </div>
      ) : <Card className="text-xs text-ink-3">Tap <b className="text-ink">Start</b> on the active task card (or start a linked focus session) — after 3 starts per block Kairo shows how often you begin on time.</Card>}
    </Section>
  )
}

export function EnergyPeaks() {
  const data = useStore()
  const { rows, peaks, total } = useMemo(() => energyByHour(data), [data])
  return (
    <Section title="Your energy by hour">
      <Card className="space-y-3">
        {total < 6 ? <div className="text-xs text-ink-3">Rate your energy after finishing tasks (low / ok / high). After ~a week you’ll see your peak hours here.</div> : (
          <>
            <div className="flex items-end gap-1 h-20">
              {rows.map(r => (
                <div key={r.hour} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div className="w-full rounded-t-md" style={{ background: r.avg >= 2.5 ? '#9BE7C4' : r.avg >= 1.8 ? '#FFCF7A' : '#FF8A8A' }} initial={{ height: 0 }} animate={{ height: `${(r.avg / 3) * 64}px` }} />
                  <span className="text-[9px] text-ink-3">{r.hour % 12 || 12}{r.hour < 12 ? 'a' : 'p'}</span>
                </div>
              ))}
            </div>
            {peaks.length > 0 && <div className="text-xs leading-relaxed"><Zap size={13} className="text-success inline -mt-0.5 mr-1" />Peak hours: <b>{peaks.map(p => `${p.hour % 12 || 12}${p.hour < 12 ? ' AM' : ' PM'}`).join(', ')}</b> — put deep work here.</div>}
          </>
        )}
      </Card>
    </Section>
  )
}
