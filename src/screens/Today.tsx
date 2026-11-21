import { LayoutGroup, motion } from 'framer-motion'
import { CalendarClock, CalendarDays, Check, ChevronLeft, Moon, Pencil, Plus, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ActiveCard, TaskRow } from '../components/Tasks'
import { AddTaskSheet, TaskSheet } from '../components/TaskSheets'
import { Field, Pill, Ring, Section, Sheet, spring } from '../components/ui'
import { useDay, useNow } from '../lib/hooks'
import { focusInstance } from '../lib/schedule'
import { addDays, dateKey, fmtDur, greeting, pad, prettyDate, weekdayLong, weekdayShort, weekOf } from '../lib/time'
import type { ActivityInstance } from '../lib/types'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'
import { dailySummary } from '../lib/analytics'
import { InstallBanner } from '../components/InstallBanner'

export default function Today() {
  const now = useNow(15000)
  const today = dateKey(now)
  const [date, setDate] = useState(today)
  const { items, stats } = useDay(date, now)
  const complete = useStore(s => s.complete)
  const skip = useStore(s => s.skip)
  const name = useStore(s => s.settings.name)
  const { openFocus, open } = useNav()
  const [sheetItem, setSheetItem] = useState<ActivityInstance | null>(null)
  const [adding, setAdding] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [editPr, setEditPr] = useState(false)

  const isToday = date === today
  const focus = isToday ? focusInstance(items) : undefined
  const overdue = items.filter(i => i.status === 'overdue')
  const upcoming = items.filter(i => (i.status === 'upcoming' || i.status === 'active') && i.key !== focus?.key)
  const closed = items.filter(i => i.status === 'done' || i.status === 'skipped' || i.status === 'moved')
  const week = weekOf(date)

  const doComplete = (i: ActivityInstance) => complete(i)
  const startFocus = (i: ActivityInstance) =>
    openFocus({ label: i.title, category: i.category, minutes: i.focusMinutes ?? Math.max(15, Math.min(120, i.endMin - i.startMin)), instanceKey: i.key })

  const timeStr = `${now.getHours() % 12 || 12}:${pad(now.getMinutes())} ${now.getHours() >= 12 ? 'PM' : 'AM'}`
  const endOfDay = isToday && !focus

  return (
    <div className="space-y-4">
      {/* Top navigation */}
      <div className="flex items-center gap-2.5 pt-2">
        <motion.button whileTap={{ scale: 0.9 }} aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}
          className="glass grid place-items-center size-9 rounded-full shrink-0"><ChevronLeft size={16} /></motion.button>
        <div className="flex-1 flex justify-between">
          {week.map(d => {
            const sel = d === date
            return (
              <motion.button key={d} whileTap={{ scale: 0.92 }} onClick={() => setDate(d)}
                className="relative w-9 h-12 rounded-[14px] flex flex-col items-center justify-center gap-0.5">
                {sel && <motion.span layoutId="day-sel" transition={spring} className="absolute inset-0 rounded-[14px] glass-strong !border-white/35" />}
                <span className={`relative text-[10px] font-medium ${sel ? 'text-peach' : 'text-ink-3'}`}>{weekdayShort(d)[0]}</span>
                <span className={`relative text-sm ${sel ? 'font-bold' : 'font-semibold text-ink-2'}`}>{Number(d.slice(8))}</span>
                {d === today && <span className={`relative size-1 rounded-full ${sel ? 'bg-peach' : 'bg-ink-3'}`} />}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold tracking-[.08em] uppercase text-ink-3">
            {weekdayLong(date)} · {prettyDate(date)}{isToday ? ` · ${timeStr}` : ''}
          </div>
          <h1 className="text-[24px] font-bold tracking-tight">{isToday ? `${greeting(now)}${name ? `, ${name}` : ''}` : date < today ? 'Looking back' : 'Planning ahead'}</h1>
        </div>
        {!isToday && <Pill onClick={() => setDate(today)} className="h-8 text-xs">Today</Pill>}
      </div>

      {/* Progress */}
      <div className="glass rounded-[22px] px-4 py-3.5 flex items-center gap-3.5">
        <Ring pct={stats.pct}><Check size={16} strokeWidth={2.6} className="text-peach" /></Ring>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-bold">{stats.done} of {stats.eligible} done</div>
              <div className="text-[11px] font-medium text-ink-3">
                {stats.skipped} skipped · {stats.overdue} overdue{stats.rescheduled ? ` · ${stats.rescheduled} moved` : ''}
              </div>
            </div>
            <motion.div key={stats.pct} initial={{ scale: 1.25, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={spring}
              className="text-[22px] font-extrabold tracking-tight text-peach">{stats.pct}%</motion.div>
          </div>
          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
            <motion.div className="h-full rounded-full peach-grad" initial={false} animate={{ width: `${stats.pct}%` }} transition={spring} />
          </div>
        </div>
      </div>

      {isToday && <InstallBanner />}

      <Priorities date={date} editing={editPr} setEditing={setEditPr} />

      <LayoutGroup>
        {/* Now */}
        {focus && (
          <Section title={focus.status === 'active' ? 'Now' : 'Up next'} right={<button onClick={() => open('timetable')} className="text-xs font-semibold text-lavender">Full timetable</button>}>
              <ActiveCard key={focus.key} item={focus} now={now}
                onDone={() => doComplete(focus)} onSkip={() => skip(focus)} onMore={() => setSheetItem(focus)}
                onFocus={focus.end ? () => startFocus(focus) : undefined} />
          </Section>
        )}

        {endOfDay && <EndOfDay date={date} />}

        {/* Missed */}
        {overdue.length > 0 && (
          <Section title={`Missed · ${overdue.length}`}>
            <div className="space-y-2">
              {overdue.map(i => (
                <motion.div layout key={i.key} className="glass rounded-[18px] p-3 space-y-2.5 !border-warning/25">
                  <div className="flex items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{i.title}</div>
                      <div className="text-xs text-warning">{fmtDur(Math.max(0, (now.getHours() * 60 + now.getMinutes()) - i.endMin))} ago</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Pill variant="white" className="h-8 text-xs flex-1 whitespace-nowrap !px-2" onClick={() => doComplete(i)}>Complete now</Pill>
                    <Pill className="h-8 text-xs flex-1" onClick={() => setSheetItem(i)}>Reschedule</Pill>
                    <Pill className="h-8 text-xs flex-1" onClick={() => skip(i)}>Skip</Pill>
                  </div>
                </motion.div>
              ))}
            </div>
          </Section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <Section title={isToday ? 'Later today' : 'Schedule'} right={upcoming.length > 3 ? (
            <button onClick={() => setShowAll(v => !v)} className="text-xs font-semibold text-lavender">{showAll ? 'Show less' : `${upcoming.length - 3} more`}</button>) : undefined}>
            <div className="space-y-2">
              {(showAll || !isToday ? upcoming : upcoming.slice(0, 3)).map(i => <TaskRow key={i.key} item={i} onClick={() => setSheetItem(i)} />)}
            </div>
          </Section>
        )}

        {closed.length > 0 && (
          <Section title={`Completed & skipped · ${closed.length}`}>
            <div className="space-y-2">{closed.map(i => <TaskRow key={i.key} item={i} onClick={() => setSheetItem(i)} />)}</div>
          </Section>
        )}
      </LayoutGroup>

      {/* Quick actions */}
      <Section title="Quick actions">
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: <Timer size={20} className="text-peach" />, l: 'Focus', f: () => focus ? startFocus(focus) : useNav.getState().setTab('focus') },
            { icon: <Plus size={20} className="text-lavender" />, l: 'Add slot', f: () => setAdding(true) },
            { icon: <CalendarClock size={20} className="text-success" />, l: 'Reschedule', f: () => focus && setSheetItem(focus) },
            { icon: <CalendarDays size={20} className="text-warning" />, l: 'Timetable', f: () => open('timetable') },
          ].map(a => (
            <motion.button key={a.l} whileTap={{ scale: 0.93 }} onClick={a.f} className="glass rounded-[18px] py-3 flex flex-col items-center gap-1.5">
              {a.icon}<span className="text-[11px] font-semibold text-ink-2">{a.l}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      <TaskSheet item={sheetItem} dayItems={items} onClose={() => setSheetItem(null)} onComplete={doComplete} onFocus={startFocus} />
      <AddTaskSheet open={adding} onClose={() => setAdding(false)} date={date} dayItems={items} />

    </div>
  )
}

function Priorities({ date, editing, setEditing }: { date: string; editing: boolean; setEditing: (v: boolean) => void }) {
  const items = useStore(s => s.priorities[date]) ?? []
  const setPriorities = useStore(s => s.setPriorities)
  const [draft, setDraft] = useState<string[]>(['', '', ''])
  const filled = items.filter(Boolean)
  return (
    <>
      <Section title="Today's priorities" right={<button onClick={() => { setDraft([0, 1, 2].map(i => items[i] ?? '')); setEditing(true) }} className="text-xs font-semibold text-lavender flex items-center gap-1"><Pencil size={12} /> Edit</button>}>
        {filled.length ? (
          <div className="glass rounded-[20px] p-3.5 space-y-2">
            {filled.map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-sm font-semibold">
                <span className="grid place-items-center size-6 rounded-lg bg-peach/15 text-peach text-xs font-extrabold">{i + 1}</span>{p}
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => { setDraft(['', '', '']); setEditing(true) }} className="w-full glass rounded-[20px] p-3.5 text-left text-sm text-ink-3">
            Set your top 3 priorities for {date === dateKey() ? 'today' : prettyDate(date)}…
          </button>
        )}
      </Section>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Top 3 priorities">
        <div className="space-y-3">
          {draft.map((v, i) => (
            <Field key={i} label={`Priority ${i + 1}`}>
              <input className="field" value={v} onChange={e => setDraft(d => d.map((x, j) => (j === i ? e.target.value : x)))} placeholder="What matters most?" />
            </Field>
          ))}
          <Pill variant="lavender" className="w-full h-12" onClick={() => { setPriorities(date, draft.map(x => x.trim())); setEditing(false) }}>Save priorities</Pill>
        </div>
      </Sheet>
    </>
  )
}

function EndOfDay({ date }: { date: string }) {
  const data = useStore()
  const s = useMemo(() => dailySummary(data, date), [data, date])
  return (
    <Section title="Daily summary">
      <div className="rounded-[24px] p-4 space-y-3" style={{ background: 'linear-gradient(160deg,#241a40,#14112a)', border: '1px solid rgb(201 184 255 / .25)' }}>
        <div className="flex items-center gap-2 text-lavender text-sm font-bold"><Moon size={16} /> Day wrapped</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[[`${s.stats.done}`, 'completed'], [`${s.missed.length}`, 'missed/skipped'], [fmtDur(s.focusMin), 'focus']].map(([v, l]) => (
            <div key={l} className="glass rounded-2xl py-2.5"><div className="text-lg font-extrabold">{v}</div><div className="text-[10px] text-ink-3 font-semibold">{l}</div></div>
          ))}
        </div>
        <div className="text-xs text-ink-2 space-y-1">
          <div>Study: <b className="text-ink">{fmtDur(s.studyMin)}</b> · Outreach: <b className="text-ink">{s.biz.calls} calls, {s.biz.dms} DMs</b></div>
          {s.tomorrowPriorities.length > 0 && <div>Tomorrow: <b className="text-ink">{s.tomorrowPriorities.join(' · ')}</b></div>}
        </div>
        {s.missed.length > 0 && <div className="text-xs text-ink-3">Tip: open a missed item to move it to tomorrow.</div>}
      </div>
    </Section>
  )
}
