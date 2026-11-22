import { Check, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Bar, Card, CATEGORIES, CatIcon, Empty, Field, Pill, ScreenHeader, Sheet, confirmDelete } from '../components/ui'
import { goalProgress, quarterOf, quarterRange } from '../lib/insightsPlus'
import { dateKey, diffDays, fmtDur, prettyDate, uid } from '../lib/time'
import type { QuarterGoal } from '../lib/types'
import { useStore } from '../store/useStore'

export default function Goals() {
  const data = useStore()
  const today = dateKey()
  const q = quarterOf(today)
  const [quarter, setQuarter] = useState(q)
  const [edit, setEdit] = useState<QuarterGoal | null>(null)
  const goals = data.goals.filter(g => g.quarter === quarter)
  const { start, end } = quarterRange(quarter)
  const elapsed = Math.min(100, Math.max(0, Math.round((diffDays(today, start) / (diffDays(end, start) + 1)) * 100)))
  const quarters = [...new Set([q, ...data.goals.map(g => g.quarter)])].sort().reverse()
  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="3 big outcomes per quarter" title="Goals"
        right={<Pill variant="lavender" className="h-9" disabled={quarter !== q || goals.length >= 3} onClick={() => setEdit({ id: uid(), title: '', quarter: q, categories: [], milestones: [], createdAt: Date.now() })}><Plus size={16} /> Goal</Pill>} />
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">{quarters.map(x => <button key={x} onClick={() => setQuarter(x)} className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold ${x === quarter ? 'bg-white text-on-peach' : 'glass text-ink-2'}`}>{x.replace('-', ' ')}</button>)}</div>
      <Card className="space-y-1.5"><div className="flex justify-between text-xs"><span className="text-ink-2">{prettyDate(start)} – {prettyDate(end)}</span><b>{elapsed}% of quarter gone</b></div><Bar pct={elapsed} grad="lav-grad" /></Card>
      {goals.length === 0 ? <Empty icon={<Target size={18} className="text-peach" />} title="No goals for this quarter" hint="Pick up to 3. Link categories (e.g. Business, Content) so tasks and focus time count toward them automatically." /> :
        goals.map(g => {
          const p = goalProgress(g, data)
          return (
            <Card key={g.id} onClick={() => setEdit(g)} className="space-y-2.5">
              <div className="flex items-center gap-2"><Target size={16} className="text-peach" /><b className="flex-1">{g.title}</b>{p.milestonePct !== null && <span className="text-sm font-extrabold text-lavender">{p.milestonePct}%</span>}</div>
              {p.milestonePct !== null && <Bar pct={p.milestonePct} grad={p.milestonePct >= elapsed ? 'lav-grad' : 'peach-grad'} />}
              <div className="flex flex-wrap gap-1.5">{g.categories.map(c => <span key={c} className="flex items-center gap-1 rounded-full bg-white/6 px-2 py-1 text-[10px] font-bold"><CatIcon c={c} size={11} />{c}</span>)}</div>
              <div className="text-[11px] text-ink-2">{p.tasks} linked tasks done · {fmtDur(p.focusMin)} focus this quarter{p.milestonePct !== null ? ` · ${g.milestones.filter(m => m.done).length}/${g.milestones.length} milestones` : ''}</div>
              {p.milestonePct !== null && p.milestonePct < elapsed - 15 && <div className="text-[11px] text-warning">Behind pace — {elapsed}% of the quarter is gone.</div>}
            </Card>
          )
        })}
      <GoalSheet g={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function GoalSheet({ g, onClose }: { g: QuarterGoal | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!g && s.goals.some(x => x.id === g.id))
  const [f, setF] = useState<QuarterGoal | null>(g)
  const [ms, setMs] = useState('')
  if (g && f?.id !== g.id) setF(g)
  if (!g || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  return (
    <Sheet open onClose={onClose} title={exists ? 'Edit goal' : 'New goal'}>
      <div className="space-y-3">
        <Field label="Goal"><input className="field" placeholder="Sign 5 new clients" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Counts toward it (categories)">
          <div className="flex flex-wrap gap-1.5">{CATEGORIES.map(c => {
            const on = f.categories.includes(c)
            return <button key={c} onClick={() => setF({ ...f, categories: on ? f.categories.filter(x => x !== c) : [...f.categories, c] })} className={`h-8 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${on ? 'bg-white text-on-peach' : 'glass text-ink-2'}`}><CatIcon c={c} size={11} />{c}</button>
          })}</div>
        </Field>
        <Field label="Milestones">
          <div className="space-y-1.5">
            {f.milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2 glass rounded-xl px-3 py-2">
                <button onClick={() => setF({ ...f, milestones: f.milestones.map(x => (x.id === m.id ? { ...x, done: !x.done } : x)) })} className={`size-5 rounded-md grid place-items-center border ${m.done ? 'bg-lavender border-lavender' : 'border-white/25'}`}>{m.done && <Check size={12} strokeWidth={3} color="#1B1430" />}</button>
                <span className={`flex-1 text-sm ${m.done ? 'line-through text-ink-3' : ''}`}>{m.title}</span>
                <button onClick={() => setF({ ...f, milestones: f.milestones.filter(x => x.id !== m.id) })} aria-label="Remove"><Trash2 size={13} className="text-ink-3" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="field flex-1" placeholder="e.g. 2nd client signed" value={ms} onChange={e => setMs(e.target.value)} />
              <Pill onClick={() => { if (ms.trim()) { setF({ ...f, milestones: [...f.milestones, { id: uid(), title: ms.trim(), done: false }] }); setMs('') } }}><Plus size={16} /></Pill>
            </div>
          </div>
        </Field>
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete(f.title)) { remove('goals', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.title.trim()} onClick={() => { save('goals', { ...f, title: f.title.trim() }); onClose() }}>Save goal</Pill>
        </div>
      </div>
    </Sheet>
  )
}
