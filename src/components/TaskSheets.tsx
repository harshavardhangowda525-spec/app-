import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarArrowUp, Check, Clock, SkipForward, Timer, Undo2 } from 'lucide-react'
import type { ActivityInstance, Category } from '../lib/types'
import { addDays, dateKey, fmtDur, fmtRange, fromMin, prettyDateLong, toMin } from '../lib/time'
import { conflictsWith } from '../lib/schedule'
import { useStore } from '../store/useStore'
import { CATEGORIES, CatIcon, Field, Pill, Sheet } from './ui'

function ConflictNote({ hits }: { hits: { title: string; start: string; end?: string }[] }) {
  if (!hits.length) return null
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex gap-2">
      <AlertTriangle size={16} className="shrink-0" />
      <div>
        <div className="font-bold">Overlaps {hits.length === 1 ? 'another activity' : `${hits.length} activities`}</div>
        {hits.map((h, i) => <div key={i} className="text-warning/80">{h.title} · {fmtRange(h.start, h.end)}</div>)}
        <div className="mt-1 text-warning/70">Nothing will be overwritten — both stay on your timeline.</div>
      </div>
    </div>
  )
}

export function TaskSheet({ item, dayItems, onClose, onComplete, onFocus }: {
  item: ActivityInstance | null; dayItems: ActivityInstance[]; onClose: () => void
  onComplete: (i: ActivityInstance) => void; onFocus: (i: ActivityInstance) => void
}) {
  const { skip, undo, reschedule, moveToDate } = useStore()
  const [mode, setMode] = useState<'main' | 'reschedule' | 'move'>('main')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('')
  const [target, setTarget] = useState(addDays(dateKey(), 1))

  useEffect(() => {
    if (!item) return
    setMode('main')
    const nowM = new Date().getHours() * 60 + new Date().getMinutes()
    const dur = item.endMin - item.startMin
    const s = item.status === 'overdue' ? Math.ceil((nowM + 5) / 15) * 15 : item.startMin
    setStart(fromMin(s))
    setEnd(item.end ? fromMin(s + dur) : '')
    setTarget(addDays(item.date, 1))
  }, [item])

  const hits = useMemo(() => {
    if (!item) return []
    return conflictsWith({ id: item.id, start, end: end || undefined }, dayItems.filter(d => d.status !== 'moved'))
  }, [item, start, end, dayItems])

  if (!item) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const closed = item.status === 'done' || item.status === 'skipped' || item.status === 'moved'
  const overdue = item.status === 'overdue'

  return (
    <Sheet open={!!item} onClose={onClose} title={mode === 'reschedule' ? 'Reschedule' : mode === 'move' ? 'Move to another day' : item.title}>
      {mode === 'main' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center size-11 rounded-2xl bg-white/8"><CatIcon c={item.category} size={20} /></div>
            <div>
              <div className="text-sm font-semibold">{fmtRange(item.start, item.end)}{item.end && ` · ${fmtDur(item.endMin - item.startMin)}`}</div>
              <div className="text-xs text-ink-2">{item.category} · {prettyDateLong(item.date)}{item.rescheduled ? ' · rescheduled' : ''}</div>
            </div>
          </div>
          {item.description && <p className="text-sm text-ink-2">{item.description}</p>}
          {overdue && (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              This activity's window has passed and it hasn't been marked. What would you like to do?
            </div>
          )}
          {closed ? (
            <div className="space-y-3">
              <div className="text-sm text-ink-2">
                {item.status === 'done' ? `Completed${item.completion?.late ? ' (late)' : ''} at ${new Date(item.completion!.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : item.status === 'skipped' ? 'Skipped — not counted as completed.' : `Moved to ${item.completion?.movedTo}`}
              </div>
              <Pill onClick={() => { undo(item.key); onClose() }} className="w-full"><Undo2 size={16} /> Undo</Pill>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Pill variant="white" className="col-span-2 h-12" onClick={() => { onComplete(item); onClose() }}><Check size={18} /> {overdue ? 'Complete now' : 'Mark done'}</Pill>
              <Pill onClick={() => setMode('reschedule')}><Clock size={16} /> Reschedule</Pill>
              <Pill onClick={() => { skip(item); onClose() }}><SkipForward size={16} /> Skip</Pill>
              <Pill onClick={() => setMode('move')}><CalendarArrowUp size={16} /> Move day</Pill>
              <Pill onClick={() => { onFocus(item); onClose() }}><Timer size={16} /> Focus</Pill>
            </div>
          )}
        </div>
      )}
      {mode === 'reschedule' && (
        <div className="space-y-3">
          <p className="text-xs text-ink-2">Changes this day only — your master timetable stays the same.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><input type="time" className="field" value={start} onChange={e => {
              const ns = e.target.value; if (!ns) return
              if (item.end) setEnd(fromMin(toMin(ns) + (item.endMin - item.startMin)))
              setStart(ns)
            }} /></Field>
            {item.end && <Field label="End"><input type="time" className="field" value={end} onChange={e => setEnd(e.target.value)} /></Field>}
          </div>
          <ConflictNote hits={hits} />
          <div className="flex gap-2">
            <Pill className="flex-1" onClick={() => setMode('main')}>Back</Pill>
            <Pill variant="lavender" className="flex-1" disabled={!!end && toMin(end) <= toMin(start)}
              onClick={() => { reschedule(item, start, end || undefined); onClose() }}>Save</Pill>
          </div>
        </div>
      )}
      {mode === 'move' && (
        <div className="space-y-3">
          <p className="text-xs text-ink-2">Carries this activity to another date. Today's record keeps it as "moved" (not counted as missed or done).</p>
          <Field label="Date"><input type="date" className="field" min={dateKey()} value={target} onChange={e => setTarget(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Pill className="flex-1" onClick={() => setMode('main')}>Back</Pill>
            <Pill variant="lavender" className="flex-1" disabled={!target || target === item.date} onClick={() => { moveToDate(item, target); onClose() }}>Move</Pill>
          </div>
        </div>
      )}
    </Sheet>
  )
}

export function AddTaskSheet({ open, onClose, date, dayItems }: { open: boolean; onClose: () => void; date: string; dayItems: ActivityInstance[] }) {
  const addExtra = useStore(s => s.addExtra)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('Personal')
  const [d, setD] = useState(date)
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('10:30')
  useEffect(() => { if (open) { setD(date); setTitle('') } }, [open, date])
  const hits = d === date ? conflictsWith({ id: '_new', start, end: end || undefined }, dayItems.filter(x => x.status !== 'moved')) : []
  return (
    <Sheet open={open} onClose={onClose} title="Add task">
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault(); if (!title.trim()) return
        addExtra({ title: title.trim(), category, date: d, start, end: end || undefined })
        onClose()
      }}>
        <Field label="Title"><input autoFocus className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Call accountant" /></Field>
        <Field label="Category">
          <select className="field" value={category} onChange={e => setCategory(e.target.value as Category)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className="field" value={d} onChange={e => setD(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" className="field" value={start} onChange={e => setStart(e.target.value)} /></Field>
          <Field label="End (optional)"><input type="time" className="field" value={end} onChange={e => setEnd(e.target.value)} /></Field>
        </div>
        <ConflictNote hits={hits} />
        <Pill type="submit" variant="lavender" className="w-full h-12" disabled={!title.trim() || (!!end && toMin(end) <= toMin(start))}>Add to {d === date ? 'this day' : d}</Pill>
      </form>
    </Sheet>
  )
}

export { ConflictNote }
