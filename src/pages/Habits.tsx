import { motion } from 'framer-motion'
import { BellOff, BellRing, CalendarClock, Check, Clock, Plus, SkipForward, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, Field, Pill, ScreenHeader, Section, Sheet, confirmDelete } from '../components/ui'
import { describeRule, firstDue } from '../lib/recurrence'
import { isNative } from '../lib/notify'
import { dateKey, diffDays, fmt12, prettyDate, uid } from '../lib/time'
import type { RecurrenceRule, Reminder } from '../lib/types'
import { useStore } from '../store/useStore'

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Habits() {
  const reminders = useStore(s => s.reminders)
  const { reminderAction, snoozeReminder, rescheduleReminder, activateReminder } = useStore()
  const [edit, setEdit] = useState<Reminder | null>(null)
  const [act, setAct] = useState<Reminder | null>(null)
  const [resch, setResch] = useState<Reminder | null>(null)
  const today = dateKey()
  const pending = reminders.filter(r => !r.startDate)
  const active = reminders.filter(r => r.startDate && r.active).sort((a, b) => (a.nextDue ?? '9').localeCompare(b.nextDue ?? '9'))
  const nowHM = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
  const due = active.filter(r => r.nextDue && (r.nextDue < today || (r.nextDue === today && r.time <= nowHM)) && !(r.snoozedUntil && r.snoozedUntil > Date.now()))

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="Recurring reminders" title="Habits"
        right={<Pill variant="lavender" className="h-9" onClick={() => setEdit({ id: uid(), title: '', rule: { type: 'daily' }, time: '09:00', startDate: null, nextDue: null, active: false, notify: true, history: [], createdAt: Date.now() })}><Plus size={16} /></Pill>} />
      {!isNative() && (
        <div className="glass rounded-2xl p-3 text-xs text-ink-2 leading-relaxed">
          In the browser, reminders only fire while Kairo is open. Install the Android build for alarm-style notifications that work when the app is closed.
        </div>
      )}

      {pending.length > 0 && (
        <Section title="Choose a start date">
          {pending.map(r => (
            <Card key={r.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-ink-3">{describeRule(r.rule)} · waiting for your start date</div>
              </div>
              <Pill className="h-8 text-xs" onClick={() => setAct(r)}>Activate</Pill>
            </Card>
          ))}
        </Section>
      )}

      {due.length > 0 && (
        <Section title={`Due now · ${due.length}`}>
          {due.map(r => (
            <motion.div layout key={r.id} className="peach-card rounded-[22px] p-4 space-y-3 text-white">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-on-peach/70">{describeRule(r.rule)}{r.nextDue! < today ? ` · ${diffDays(today, r.nextDue!)}d overdue` : ''}</div>
                <div className="text-lg font-extrabold">{r.title}</div>
              </div>
              <div className="flex gap-2">
                <Pill variant="white" className="flex-1 h-9 text-xs" onClick={() => reminderAction(r.id, 'done')}><Check size={14} /> Done</Pill>
                <Pill className="h-9 text-xs !bg-white/20" onClick={() => snoozeReminder(r.id, 60)}><Clock size={14} /> 1h</Pill>
                <Pill className="h-9 text-xs !bg-white/20" onClick={() => setResch(r)}><CalendarClock size={14} /></Pill>
                <Pill className="h-9 text-xs !bg-white/20" onClick={() => reminderAction(r.id, 'skipped')}><SkipForward size={14} /></Pill>
              </div>
            </motion.div>
          ))}
        </Section>
      )}

      <Section title="All reminders">
        <div className="space-y-2">
          {active.map(r => (
            <Card key={r.id} onClick={() => setEdit(r)} className="flex items-center gap-3">
              {r.notify ? <BellRing size={18} className="text-lavender shrink-0" /> : <BellOff size={18} className="text-ink-3 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{r.title}</div>
                <div className="text-xs text-ink-3 truncate">{describeRule(r.rule)} · {fmt12(r.time)}{r.history.length ? ` · ${r.history.filter(h => h.action === 'done').length} done` : ''}</div>
              </div>
              <div className={`text-xs font-bold ${r.nextDue && r.nextDue <= today ? 'text-peach' : 'text-ink-2'}`}>
                {r.nextDue ? (r.nextDue === today ? 'Today' : prettyDate(r.nextDue)) : '—'}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <ActivateSheet r={act} onClose={() => setAct(null)} onActivate={(d) => { activateReminder(act!.id, d); setAct(null) }} />
      <Sheet open={!!resch} onClose={() => setResch(null)} title="Reschedule reminder">
        <ResDate onSave={d => { rescheduleReminder(resch!.id, d); setResch(null) }} />
      </Sheet>
      <ReminderSheet r={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function ResDate({ onSave, label = 'Save' }: { onSave: (d: string) => void; label?: string }) {
  const [d, setD] = useState(dateKey())
  return (
    <div className="space-y-3">
      <Field label="Date"><input type="date" className="field" value={d} onChange={e => setD(e.target.value)} /></Field>
      <Pill variant="lavender" className="w-full h-12" disabled={!d} onClick={() => onSave(d)}>{label}</Pill>
    </div>
  )
}

function ActivateSheet({ r, onClose, onActivate }: { r: Reminder | null; onClose: () => void; onActivate: (d: string) => void }) {
  return (
    <Sheet open={!!r} onClose={onClose} title={r ? `Start “${r.title}”` : ''}>
      <p className="text-sm text-ink-2 mb-3">Pick the date you last did this (today if you just did it). Kairo counts {r ? describeRule(r.rule).toLowerCase() : ''} from that date — nothing is assumed.</p>
      <ResDate onSave={onActivate} label="Activate reminder" />
    </Sheet>
  )
}

function ReminderSheet({ r, onClose }: { r: Reminder | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!r && s.reminders.some(x => x.id === r.id))
  const [f, setF] = useState<Reminder | null>(r)
  if (r && f?.id !== r.id) setF(r)
  if (!r || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const setRule = (rule: RecurrenceRule) => setF({ ...f, rule })
  const t = f.rule.type
  return (
    <Sheet open onClose={onClose} title={exists ? 'Edit reminder' : 'New reminder'}>
      <div className="space-y-3">
        <Field label="Title"><input className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Repeats">
          <select className="field" value={t} onChange={e => {
            const v = e.target.value as RecurrenceRule['type']
            setRule(v === 'daily' ? { type: 'daily' } : v === 'everyNDays' ? { type: 'everyNDays', n: 3 } : v === 'weekly' ? { type: 'weekly', weekdays: [1] } : v === 'monthly' ? { type: 'monthly', day: 1 } : { type: 'everyNMonths', n: 6 })
          }}>
            <option value="daily">Daily</option><option value="everyNDays">Every N days</option><option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option><option value="everyNMonths">Every N months (e.g. 6)</option>
          </select>
        </Field>
        {f.rule.type === 'everyNDays' && <Field label="Every how many days?"><input type="number" min={1} className="field" value={f.rule.n} onChange={e => setRule({ type: 'everyNDays', n: Math.max(1, Number(e.target.value)) })} /></Field>}
        {f.rule.type === 'everyNMonths' && <Field label="Every how many months?"><input type="number" min={1} className="field" value={f.rule.n} onChange={e => setRule({ type: 'everyNMonths', n: Math.max(1, Number(e.target.value)) })} /></Field>}
        {f.rule.type === 'monthly' && <Field label="Day of month"><input type="number" min={1} max={31} className="field" value={f.rule.day} onChange={e => setRule({ type: 'monthly', day: Math.min(31, Math.max(1, Number(e.target.value))) })} /></Field>}
        {f.rule.type === 'weekly' && (() => {
          const wd = f.rule.weekdays
          return (
            <div className="flex gap-1.5">{WD.map((d, i) => (
              <button key={i} onClick={() => setRule({ type: 'weekly', weekdays: wd.includes(i) ? wd.filter(x => x !== i) : [...wd, i] })}
                className={`flex-1 h-9 rounded-full text-xs font-bold ${wd.includes(i) ? 'bg-lavender text-purple-deep' : 'glass text-ink-2'}`}>{d}</button>
            ))}</div>
          )
        })()}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time"><input type="time" className="field" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></Field>
          <Field label="Start date"><input type="date" className="field" value={f.startDate ?? ''} onChange={e => setF({ ...f, startDate: e.target.value || null })} /></Field>
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={f.notify} onChange={e => setF({ ...f, notify: e.target.checked })} className="size-4 accent-[#C9B8FF]" /> Send notification</label>
        {f.history.length > 0 && (
          <div className="text-xs text-ink-3 space-y-0.5 max-h-28 overflow-y-auto">
            {[...f.history].reverse().slice(0, 12).map((h, i) => <div key={i}>{new Date(h.at).toLocaleDateString()} · {h.action} (due {prettyDate(h.dueDate)})</div>)}
          </div>
        )}
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete(f.title)) { remove('reminders', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.title.trim() || (f.rule.type === 'weekly' && !f.rule.weekdays.length)} onClick={() => {
            const changed = !r.nextDue || r.startDate !== f.startDate || JSON.stringify(r.rule) !== JSON.stringify(f.rule)
            save('reminders', { ...f, active: !!f.startDate, nextDue: f.startDate ? (changed ? firstDue(f.rule, f.startDate, dateKey()) : f.nextDue) : null })
            onClose()
          }}>Save</Pill>
        </div>
      </div>
    </Sheet>
  )
}
