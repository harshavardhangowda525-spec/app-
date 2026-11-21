import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LEVEL_COLORS, METRICS, activityEvents, level, weight, type ActivityEvent, type Metric } from '../lib/activity'
import { addDays, addMonths, dateKey, fmtDur, parseKey, prettyDate, prettyDateLong, weekOf } from '../lib/time'
import { useStore } from '../store/useStore'
import { CatIcon, Segmented } from './ui'

type Range = 'year' | 'month' | 'week' | 'day'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5) // 5 AM – 10 PM
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`

/**
 * GitHub-style contribution heatmap for Kairo. Every cell is computed from stored records only.
 * Year → weeks × weekdays · Month → calendar · Week → days × hours · Day → hours + what you did.
 */
export default function Heatmap() {
  const data = useStore()
  const today = dateKey()
  const [range, setRange] = useState<Range>('year')
  const [metric, setMetric] = useState<Metric>('all')
  const [anchor, setAnchor] = useState(today)

  const events = useMemo(() => activityEvents(data), [data])
  const byDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of events) { const w = weight(e, metric); if (w) m.set(e.date, (m.get(e.date) ?? 0) + w) }
    return m
  }, [events, metric])
  const byHour = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of events) { const w = weight(e, metric); if (w) { const k = `${e.date}|${e.hour}`; m.set(k, (m.get(k) ?? 0) + w) } }
    return m
  }, [events, metric])
  const unit = METRICS.find(x => x.v === metric)!.unit
  const fmtVal = (v: number) => (metric === 'focus' ? fmtDur(v) : String(v))

  // period days for totals/stats
  const anchorD = parseKey(anchor)
  const periodDays = useMemo(() => {
    if (range === 'year') { const out: string[] = []; for (let d = `${anchorD.getFullYear()}-01-01`; d.startsWith(String(anchorD.getFullYear())); d = addDays(d, 1)) out.push(d); return out }
    if (range === 'month') { const first = `${anchor.slice(0, 7)}-01`; const out: string[] = []; for (let d = first; d.slice(0, 7) === anchor.slice(0, 7); d = addDays(d, 1)) out.push(d); return out }
    if (range === 'week') return weekOf(anchor)
    return [anchor]
  }, [range, anchor]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = periodDays.reduce((a, d) => a + (byDay.get(d) ?? 0), 0)
  const activeDays = periodDays.filter(d => byDay.get(d)).length
  const best = periodDays.reduce<[string, number]>((b, d) => ((byDay.get(d) ?? 0) > b[1] ? [d, byDay.get(d)!] : b), ['', 0])
  const longest = useMemo(() => {
    let run = 0, bestRun = 0
    for (const d of periodDays) { if (d > today) break; run = byDay.get(d) ? run + 1 : 0; bestRun = Math.max(bestRun, run) }
    return bestRun
  }, [periodDays, byDay, today])
  const current = useMemo(() => {
    let d = byDay.get(today) ? today : addDays(today, -1), n = 0
    while (byDay.get(d) && n < 3650) { n++; d = addDays(d, -1) }
    return n
  }, [byDay, today])

  const shift = (dir: 1 | -1) => setAnchor(a =>
    range === 'year' ? `${parseKey(a).getFullYear() + dir}-${a.slice(5)}` : range === 'month' ? addMonths(a, dir) : addDays(a, range === 'week' ? 7 * dir : dir))
  const title = range === 'year' ? String(anchorD.getFullYear())
    : range === 'month' ? `${MONTHS[anchorD.getMonth()]} ${anchorD.getFullYear()}`
      : range === 'week' ? `${prettyDate(periodDays[0])} – ${prettyDate(periodDays[6])}` : prettyDateLong(anchor)
  const openDay = (d: string) => { setAnchor(d); setRange('day') }

  return (
    <div className="rounded-[22px] p-4 space-y-3.5" style={{ background: 'linear-gradient(170deg,#161326,#0d0c17)', border: '1px solid rgb(255 255 255 / .08)' }}>
      {/* Header — like a contribution graph */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <motion.div key={`${total}-${metric}-${range}-${anchor}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[17px] font-extrabold tracking-tight">
            {fmtVal(total)} {metric === 'focus' ? 'focused' : unit}
          </motion.div>
          <div className="text-xs text-ink-3">{range === 'day' ? 'on ' : 'in '}{title}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => shift(-1)} aria-label="Previous" className="glass size-8 rounded-full grid place-items-center"><ChevronLeft size={15} /></button>
          {anchor !== today && <button onClick={() => setAnchor(today)} className="glass h-8 px-2.5 rounded-full text-[11px] font-bold">Now</button>}
          <button onClick={() => shift(1)} aria-label="Next" className="glass size-8 rounded-full grid place-items-center"><ChevronRight size={15} /></button>
        </div>
      </div>

      <Segmented value={range} onChange={setRange} options={[{ v: 'year', l: 'Year' }, { v: 'month', l: 'Month' }, { v: 'week', l: 'Week' }, { v: 'day', l: 'Day' }]} />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {METRICS.map(m => (
          <button key={m.v} onClick={() => setMetric(m.v)}
            className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-bold transition-colors ${metric === m.v ? 'bg-peach text-on-peach' : 'bg-white/6 text-ink-2'}`}>{m.l}</button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${range}-${metric}-${range === 'year' ? anchor.slice(0, 4) : anchor}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {range === 'year' && <YearGrid year={anchorD.getFullYear()} byDay={byDay} today={today} onPick={openDay} fmtVal={fmtVal} />}
          {range === 'month' && <MonthGrid anchor={anchor} byDay={byDay} today={today} onPick={openDay} />}
          {range === 'week' && <WeekGrid days={periodDays} byHour={byHour} byDay={byDay} today={today} onPick={openDay} />}
          {range === 'day' && <DayView date={anchor} byHour={byHour} events={events.filter(e => e.date === anchor && weight(e, metric))} fmtVal={fmtVal} />}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between text-[10px] text-ink-3">
        <span>{range === 'day' ? 'Tap another day in Year / Month / Week' : 'Tap a day to see what you did'}</span>
        <span className="flex items-center gap-1">Less {LEVEL_COLORS.map((c, i) => <span key={i} className="size-[10px] rounded-[3px]" style={{ background: c }} />)} More</span>
      </div>

      {range !== 'day' && (
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {[
            [<span className="inline-flex items-center gap-1"><Flame size={13} className={current ? 'text-peach' : 'text-ink-3'} />{current}</span>, 'streak'],
            [longest, 'longest'],
            [`${activeDays}/${periodDays.filter(d => d <= today).length || periodDays.length}`, 'active days'],
            [best[1] ? fmtVal(best[1]) : '—', best[0] ? `best · ${prettyDate(best[0])}` : 'best day'],
          ].map(([v, l], i) => (
            <div key={i} className="rounded-xl bg-white/[.04] py-2 px-1">
              <div className="text-sm font-extrabold">{v}</div>
              <div className="text-[9.5px] text-ink-3 font-semibold truncate">{l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Cell({ v, max, size, title, onClick, isToday, children }: { v: number; max: number; size: number | string; title: string; onClick?: () => void; isToday?: boolean; children?: React.ReactNode }) {
  const lv = level(v, max)
  return (
    <button title={title} onClick={onClick} aria-label={title}
      className="rounded-[3px] shrink-0 grid place-items-center text-[10px] font-bold transition-transform active:scale-90"
      style={{
        width: size, height: size, background: LEVEL_COLORS[lv],
        boxShadow: isToday ? 'inset 0 0 0 1.5px #C9B8FF' : lv === 4 ? '0 0 8px rgba(255,180,160,.45)' : undefined,
        color: lv >= 3 ? '#2A1420' : lv ? '#F5F3FA' : 'rgb(255 255 255 / .35)',
      }}>{children}</button>
  )
}

function YearGrid({ year, byDay, today, onPick, fmtVal }: { year: number; byDay: Map<string, number>; today: string; onPick: (d: string) => void; fmtVal: (v: number) => string }) {
  const jan1 = `${year}-01-01`
  const start = addDays(jan1, -((parseKey(jan1).getDay() + 6) % 7)) // Monday on/before Jan 1
  const weeks: string[][] = []
  for (let w = start; w <= `${year}-12-31`; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)))
  const max = Math.max(0, ...[...byDay.entries()].filter(([d]) => d.startsWith(String(year))).map(([, v]) => v))
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // open scrolled to the current week
    const el = scroller.current; if (!el) return
    const idx = weeks.findIndex(w => w.includes(today))
    el.scrollLeft = idx > 0 ? Math.max(0, idx * 14 - el.clientWidth + 60) : year < Number(today.slice(0, 4)) ? el.scrollWidth : 0
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col gap-[3px] pt-[18px] text-[9px] text-ink-3 font-semibold shrink-0">
        {['Mon', '', 'Wed', '', 'Fri', '', ''].map((l, i) => <span key={i} className="h-[11px] leading-[11px]">{l}</span>)}
      </div>
      <div ref={scroller} className="overflow-x-auto no-scrollbar">
        <div className="flex gap-[3px] relative pt-[18px]">
          {weeks.map((w, wi) => {
            const firstOfMonth = w.find(d => d.endsWith('-01') && d.startsWith(String(year)))
            return (
              <div key={wi} className="flex flex-col gap-[3px] relative">
                {firstOfMonth && <span className="absolute -top-[17px] left-0 text-[9px] text-ink-3 font-semibold">{MONTHS[parseKey(firstOfMonth).getMonth()]}</span>}
                {w.map(d => d.startsWith(String(year))
                  ? <Cell key={d} v={byDay.get(d) ?? 0} max={max} size={11} isToday={d === today} title={`${prettyDate(d)}: ${fmtVal(byDay.get(d) ?? 0)}`} onClick={() => onPick(d)} />
                  : <span key={d} className="size-[11px]" />)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthGrid({ anchor, byDay, today, onPick }: { anchor: string; byDay: Map<string, number>; today: string; onPick: (d: string) => void }) {
  const first = `${anchor.slice(0, 7)}-01`
  const lead = (parseKey(first).getDay() + 6) % 7
  const days: string[] = []
  for (let d = first; d.slice(0, 7) === anchor.slice(0, 7); d = addDays(d, 1)) days.push(d)
  const max = Math.max(0, ...days.map(d => byDay.get(d) ?? 0))
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-ink-3">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {days.map(d => (
          <div key={d} className="aspect-square">
            <Cell v={byDay.get(d) ?? 0} max={max} size="100%" isToday={d === today} title={`${prettyDate(d)}: ${byDay.get(d) ?? 0}`} onClick={() => onPick(d)}>
              {Number(d.slice(8))}
            </Cell>
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekGrid({ days, byHour, today, onPick }: { days: string[]; byHour: Map<string, number>; byDay: Map<string, number>; today: string; onPick: (d: string) => void }) {
  const max = Math.max(0, ...days.flatMap(d => HOURS.map(h => byHour.get(`${d}|${h}`) ?? 0)))
  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col gap-[3px] pt-[22px] text-[9px] text-ink-3 font-semibold shrink-0 w-6">
        {HOURS.map(h => <span key={h} className="h-[13px] leading-[13px]">{h % 3 === 2 ? hourLabel(h) : ''}</span>)}
      </div>
      <div className="flex-1 grid grid-cols-7 gap-[3px]">
        {days.map(d => (
          <div key={d} className="flex flex-col gap-[3px]">
            <button onClick={() => onPick(d)} className={`h-[19px] text-[10px] font-bold ${d === today ? 'text-lavender' : 'text-ink-2'}`}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'][(parseKey(d).getDay() + 6) % 7]}<span className="text-ink-3 font-semibold"> {Number(d.slice(8))}</span>
            </button>
            {HOURS.map(h => (
              <div key={h} className="h-[13px]"><Cell v={byHour.get(`${d}|${h}`) ?? 0} max={max} size="100%" title={`${prettyDate(d)} ${hourLabel(h)}`} onClick={() => onPick(d)} /></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayView({ date, byHour, events, fmtVal }: { date: string; byHour: Map<string, number>; events: ActivityEvent[]; fmtVal: (v: number) => string }) {
  const max = Math.max(0, ...HOURS.map(h => byHour.get(`${date}|${h}`) ?? 0))
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-9 gap-1">
        {HOURS.map(h => (
          <div key={h} className="flex flex-col items-center gap-0.5">
            <div className="w-full aspect-square"><Cell v={byHour.get(`${date}|${h}`) ?? 0} max={max} size="100%" title={hourLabel(h)}>{byHour.get(`${date}|${h}`) ? fmtVal(byHour.get(`${date}|${h}`)!) : ''}</Cell></div>
            <span className="text-[9px] text-ink-3 font-semibold">{hourLabel(h)}</span>
          </div>
        ))}
      </div>
      {events.length === 0 ? (
        <div className="text-xs text-ink-3 text-center py-3">Nothing recorded for this day{date > dateKey() ? ' yet' : ''}.</div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
          {events.map((e, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white/[.04] px-3 py-2">
              {e.category !== 'Task' && <CatIcon c={e.category} size={14} />}
              <span className="flex-1 text-xs font-semibold truncate">{e.label}</span>
              <span className="text-[10px] text-ink-3">{e.minutes ? `${fmtDur(e.minutes)} · ` : ''}{new Date(e.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
