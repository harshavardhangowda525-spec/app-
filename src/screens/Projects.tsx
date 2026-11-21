import { motion } from 'framer-motion'
import { Check, FolderKanban, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Bar, Empty, Field, Pill, ScreenHeader, Section, Sheet, confirmDelete } from '../components/ui'
import { dateKey, diffDays, prettyDate, uid } from '../lib/time'
import type { ClientProject } from '../lib/types'
import { useStore } from '../store/useStore'

const STATUSES: ClientProject['status'][] = ['Planning', 'In progress', 'Review', 'Delivered', 'On hold']
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function Projects() {
  const projects = useStore(s => s.projects)
  const [edit, setEdit] = useState<ClientProject | null>(null)
  const today = dateKey()
  const activeP = projects.filter(p => p.status !== 'Delivered')
  const pendingMilestones = projects.flatMap(p => p.milestones.filter(m => !m.done).map(m => ({ ...m, project: p })))
    .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))
  const openRevisions = projects.reduce((a, p) => a + p.revisions.filter(r => !r.done).length, 0)
  const blank = (): ClientProject => ({ id: uid(), name: '', client: '', status: 'Planning', milestones: [], revisions: [], createdAt: Date.now() })

  return (
    <div className="space-y-4">
      <ScreenHeader kicker="Client development" title="Projects" right={<Pill variant="lavender" className="h-9" onClick={() => setEdit(blank())}><Plus size={16} /> Project</Pill>} />
      <div className="grid grid-cols-3 gap-2 text-center">
        {[[activeP.length, 'Active'], [pendingMilestones.length, 'Deliverables'], [openRevisions, 'Revisions']].map(([v, l]) => (
          <div key={l} className="glass rounded-[18px] py-3"><div className="text-xl font-extrabold">{v}</div><div className="text-[11px] text-ink-3 font-semibold">{l}</div></div>
        ))}
      </div>

      {pendingMilestones.length > 0 && (
        <Section title="Upcoming deadlines">
          <div className="space-y-2">
            {pendingMilestones.slice(0, 5).map(m => {
              const d = m.due ? diffDays(m.due, today) : null
              return (
                <div key={m.id} className="glass rounded-[18px] px-3.5 py-3 flex items-center gap-3" onClick={() => setEdit(m.project)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{m.title}</div>
                    <div className="text-xs text-ink-3 truncate">{m.project.name}</div>
                  </div>
                  {d !== null && <span className={`text-xs font-bold ${d < 0 ? 'text-danger' : d <= 2 ? 'text-warning' : 'text-ink-2'}`}>{d < 0 ? `${-d}d late` : d === 0 ? 'Today' : `${d}d`}</span>}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title="All projects">
        {projects.length ? (
          <div className="space-y-2">
            {projects.map(p => {
              const done = p.milestones.filter(m => m.done).length
              const pct = p.milestones.length ? (done / p.milestones.length) * 100 : 0
              return (
                <motion.div layout key={p.id} onClick={() => setEdit(p)} className="glass rounded-[20px] p-4 space-y-2.5 cursor-pointer active:scale-[0.99] transition-transform">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{p.name}</div>
                      <div className="text-xs text-ink-3">{p.client}{p.deadline ? ` · due ${prettyDate(p.deadline)}` : ''}</div>
                    </div>
                    <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-white/8 text-ink-2 shrink-0">{p.status}</span>
                  </div>
                  <Bar pct={pct} />
                  <div className="flex justify-between text-xs text-ink-3">
                    <span>{done}/{p.milestones.length} milestones · {p.revisions.filter(r => !r.done).length} revisions open</span>
                    {p.value ? <span className="text-ink-2 font-semibold">{inr(p.paid ?? 0)} / {inr(p.value)}</span> : null}
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : <Empty icon={<FolderKanban size={18} className="text-lavender" />} title="No client projects yet" hint="Track deliverables, milestones, revisions and payments for each client build." action={<Pill onClick={() => setEdit(blank())}><Plus size={16} /> New project</Pill>} />}
      </Section>
      <ProjectSheet project={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function ProjectSheet({ project, onClose }: { project: ClientProject | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!project && s.projects.some(p => p.id === project.id))
  const [f, setF] = useState<ClientProject | null>(project)
  const [ms, setMs] = useState(''); const [msDue, setMsDue] = useState(''); const [rev, setRev] = useState('')
  if (project && f?.id !== project.id) setF(project)
  if (!project || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const set = <K extends keyof ClientProject>(k: K, v: ClientProject[K]) => setF({ ...f, [k]: v })
  const num = (v: string) => (v === '' ? undefined : Number(v))
  return (
    <Sheet open onClose={onClose} title={exists ? f.name || 'Project' : 'New project'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project *"><input className="field" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Website redesign" /></Field>
          <Field label="Client *"><input className="field" value={f.client} onChange={e => set('client', e.target.value)} /></Field>
        </div>
        <Field label="Status">
          <div className="flex flex-wrap gap-1.5">{STATUSES.map(s => <button key={s} onClick={() => set('status', s)} className={`h-8 px-3 rounded-full text-xs font-bold ${f.status === s ? 'bg-white text-on-peach' : 'glass text-ink-2'}`}>{s}</button>)}</div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Deadline"><input type="date" className="field !px-2" value={f.deadline ?? ''} onChange={e => set('deadline', e.target.value)} /></Field>
          <Field label="Value ₹"><input type="number" className="field" value={f.value ?? ''} onChange={e => set('value', num(e.target.value))} /></Field>
          <Field label="Paid ₹"><input type="number" className="field" value={f.paid ?? ''} onChange={e => set('paid', num(e.target.value))} /></Field>
        </div>
        <Field label="Milestones & deliverables">
          <div className="space-y-1.5">
            {f.milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2 glass rounded-xl px-3 py-2">
                <button onClick={() => set('milestones', f.milestones.map(x => (x.id === m.id ? { ...x, done: !x.done } : x)))}
                  className={`size-5 rounded-md grid place-items-center border ${m.done ? 'bg-lavender border-lavender' : 'border-white/25'}`}>{m.done && <Check size={12} color="#1B1430" strokeWidth={3} />}</button>
                <span className={`flex-1 text-sm ${m.done ? 'line-through text-ink-3' : ''}`}>{m.title}</span>
                {m.due && <span className="text-xs text-ink-3">{prettyDate(m.due)}</span>}
                <button onClick={() => set('milestones', f.milestones.filter(x => x.id !== m.id))} aria-label="Remove"><Trash2 size={14} className="text-ink-3" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="field flex-1" placeholder="Add milestone" value={ms} onChange={e => setMs(e.target.value)} />
              <input type="date" className="field !w-[130px] !px-2" value={msDue} onChange={e => setMsDue(e.target.value)} />
              <Pill onClick={() => { if (!ms.trim()) return; set('milestones', [...f.milestones, { id: uid(), title: ms.trim(), due: msDue || undefined, done: false }]); setMs(''); setMsDue('') }}><Plus size={16} /></Pill>
            </div>
          </div>
        </Field>
        <Field label="Client revision requests">
          <div className="space-y-1.5">
            {f.revisions.map(r => (
              <div key={r.id} className="flex items-center gap-2 glass rounded-xl px-3 py-2">
                <button onClick={() => set('revisions', f.revisions.map(x => (x.id === r.id ? { ...x, done: !x.done } : x)))}
                  className={`size-5 rounded-md grid place-items-center border ${r.done ? 'bg-success border-success' : 'border-white/25'}`}>{r.done && <Check size={12} color="#0A0A12" strokeWidth={3} />}</button>
                <span className={`flex-1 text-sm ${r.done ? 'line-through text-ink-3' : ''}`}>{r.text}</span>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="field flex-1" placeholder="Add revision request" value={rev} onChange={e => setRev(e.target.value)} />
              <Pill onClick={() => { if (!rev.trim()) return; set('revisions', [...f.revisions, { id: uid(), text: rev.trim(), done: false, createdAt: Date.now() }]); setRev('') }}><Plus size={16} /></Pill>
            </div>
          </div>
        </Field>
        <Field label="Notes"><textarea rows={3} className="field" value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field>
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete(f.name)) { remove('projects', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.name.trim() || !f.client.trim()} onClick={() => { save('projects', f); onClose() }}>Save project</Pill>
        </div>
      </div>
    </Sheet>
  )
}
