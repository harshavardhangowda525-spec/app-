import { motion } from 'framer-motion'
import { Plus, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, Empty, Field, Pill, ScreenHeader, Section, Sheet, confirmDelete } from '../components/ui'
import { exerciseHistory, personalRecords } from '../lib/insightsPlus'
import { dateKey, prettyDate, uid } from '../lib/time'
import type { Workout, WorkoutExercise } from '../lib/types'
import { useStore } from '../store/useStore'
import SessionFlow, { loadDraft, type SessionDraft } from '../components/SessionFlow'
import { libFor, exImg } from '../data/exerciseLib'

const COMMON = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-ups', 'Lat pulldown', 'Incline dumbbell press', 'Leg press', 'Bicep curl', 'Tricep pushdown', 'Lateral raise']

export default function Workouts() {
  const data = useStore()
  const workouts = useMemo(() => [...data.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [data.workouts])
  const prs = useMemo(() => [...personalRecords(data).entries()].sort((a, b) => b[1].e1rm - a[1].e1rm), [data])
  const [edit, setEdit] = useState<Workout | null>(null)
  const [flow, setFlow] = useState<{ resume: SessionDraft | null } | null>(null)
  const [draft, setDraft] = useState(loadDraft)
  const [chart, setChart] = useState<string | null>(prs[0]?.[0] ?? null)
  const hist = chart ? exerciseHistory(data, chart) : []
  const last = workouts[0]
  const blank = (): Workout => ({ id: uid(), date: dateKey(), exercises: last ? last.exercises.map(e => ({ name: e.name, sets: e.sets.map(s => ({ ...s })) })) : [{ name: '', sets: [{ reps: 8, kg: 0 }] }], createdAt: Date.now() })
  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="Progressive overload" title="Workouts" right={<Pill variant="lavender" className="h-9" onClick={() => setFlow({ resume: null })}><Plus size={16} /> Session</Pill>} />
      {draft && (
        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => setFlow({ resume: draft })}
          className="w-full glass-strong !border-peach/40 rounded-[20px] p-3 flex items-center gap-3 text-left">
          <span className="size-10 rounded-full grid place-items-center text-lg" style={{ background: 'linear-gradient(135deg,#FFC79E,#EE789E)' }}>🏋️</span>
          <div className="flex-1 min-w-0"><b className="text-sm">Resume session</b><div className="text-[11px] text-ink-2 truncate">{draft.picked.length} exercises · {draft.picked.reduce((a, p) => a + p.sets.filter(x => x.done).length, 0)} sets done</div></div>
          <span className="text-xs font-extrabold text-peach">Continue →</span>
        </motion.button>
      )}
      <button onClick={() => setEdit(blank())} className="text-[11px] font-bold text-ink-3 -mt-2">or log a past session manually</button>
      {prs.length > 0 && (
        <Section title="Personal records (est. 1-rep max)">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {prs.map(([name, p]) => (
              <button key={name} onClick={() => setChart(name)} className={`shrink-0 rounded-[18px] p-3 text-left min-w-[130px] ${chart === name ? 'glass-strong !border-peach/40' : 'glass'}`}>
                <Trophy size={14} className="text-warning" />
                <div className="text-xs font-bold capitalize mt-1 truncate">{name}</div>
                <div className="text-lg font-extrabold">{p.e1rm} kg</div>
                <div className="text-[10px] text-ink-3">{p.kg} kg × {p.reps} · {prettyDate(p.date)}</div>
              </button>
            ))}
          </div>
        </Section>
      )}
      {chart && hist.length >= 2 && (
        <Card className="space-y-2">
          <div className="text-xs font-bold capitalize">{chart} · top set per session</div>
          <div className="flex items-end gap-1 h-24">
            {hist.slice(-12).map((h, i, arr) => {
              const max = Math.max(...arr.map(x => x.e1rm)), min = Math.min(...arr.map(x => x.e1rm)) * 0.9
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-ink-3">{h.e1rm}</span>
                  <motion.div className="w-full rounded-t-md" style={{ background: i === arr.length - 1 ? '#FFB59A' : '#FFB59A88' }} initial={{ height: 0 }} animate={{ height: `${((h.e1rm - min) / (max - min || 1)) * 60 + 8}px` }} transition={{ delay: i * 0.03 }} />
                  <span className="text-[9px] text-ink-3">{h.date.slice(8)}</span>
                </div>
              )
            })}
          </div>
          {hist.length >= 3 && (() => { const a = hist[hist.length - 3].e1rm, b = hist[hist.length - 1].e1rm; return <div className={`text-[11px] ${b > a ? 'text-success' : 'text-warning'}`}>{b > a ? `Up ${Math.round((b - a) * 10) / 10} kg over the last 3 sessions — overload is working.` : 'Flat for 3 sessions — add a rep or 2.5 kg next time.'}</div> })()}
        </Card>
      )}
      <Section title="Sessions">
        {workouts.length === 0 ? <Empty title="No workouts yet" hint="Log today’s session — next time Kairo pre-fills it so you just beat the numbers." /> :
          workouts.map(w => (
            <Card key={w.id} onClick={() => setEdit(w)} className="space-y-1">
              <div className="flex justify-between items-center gap-2"><b className="text-sm">{w.title || 'Workout'}</b>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">{w.exercises.map(e => libFor(e)?.id).filter(Boolean).slice(0, 3).map(id => <img key={id} src={exImg(id!, 1)} alt="" loading="lazy" className="size-6 rounded-full object-cover border-2 border-[#141424]" />)}</div>
                  <span className="text-xs text-ink-3">{prettyDate(w.date)}{w.durationMin ? ` · ${w.durationMin}m` : ''}</span>
                </div></div>
              <div className="text-[11px] text-ink-2">{w.exercises.map(e => `${e.name} ${e.sets.length}×`).join(' · ')}</div>
              <div className="text-[10px] text-ink-3">Volume {Math.round(w.exercises.flatMap(e => e.sets).reduce((a, s) => a + s.kg * s.reps, 0)).toLocaleString('en-IN')} kg</div>
            </Card>
          ))}
      </Section>
      <WorkoutSheet w={edit} onClose={() => setEdit(null)} />
      {flow && <SessionFlow resume={flow.resume} onClose={() => { setFlow(null); setDraft(loadDraft()) }} />}
    </div>
  )
}

function WorkoutSheet({ w, onClose }: { w: Workout | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!w && s.workouts.some(x => x.id === w.id))
  const [f, setF] = useState<Workout | null>(w)
  if (w && f?.id !== w.id) setF(w)
  if (!w || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const setEx = (i: number, e: WorkoutExercise) => setF({ ...f, exercises: f.exercises.map((x, j) => (j === i ? e : x)) })
  return (
    <Sheet open onClose={onClose} title={exists ? 'Edit session' : 'New session'}>
      <datalist id="ex-names">{COMMON.map(n => <option key={n} value={n} />)}</datalist>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Title"><input className="field" placeholder="Push day" value={f.title ?? ''} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className="field" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        {f.exercises.map((ex, i) => (
          <div key={i} className="glass rounded-2xl p-2.5 space-y-2">
            <div className="flex gap-2 items-center">
              <input list="ex-names" className="field flex-1 !py-2" placeholder="Exercise" value={ex.name} onChange={e => setEx(i, { ...ex, name: e.target.value })} />
              <button onClick={() => setF({ ...f, exercises: f.exercises.filter((_, j) => j !== i) })} aria-label="Remove exercise"><Trash2 size={15} className="text-ink-3" /></button>
            </div>
            {ex.sets.map((s, k) => (
              <div key={k} className="flex gap-2 items-center text-xs">
                <span className="w-10 text-ink-3 font-bold">Set {k + 1}</span>
                <input type="number" inputMode="decimal" className="field !py-1.5 !px-2 flex-1" value={s.kg || ''} placeholder="kg" onChange={e => setEx(i, { ...ex, sets: ex.sets.map((y, m) => (m === k ? { ...y, kg: Number(e.target.value) || 0 } : y)) })} />
                <span className="text-ink-3">×</span>
                <input type="number" inputMode="numeric" className="field !py-1.5 !px-2 flex-1" value={s.reps || ''} placeholder="reps" onChange={e => setEx(i, { ...ex, sets: ex.sets.map((y, m) => (m === k ? { ...y, reps: Number(e.target.value) || 0 } : y)) })} />
                <button onClick={() => setEx(i, { ...ex, sets: ex.sets.filter((_, m) => m !== k) })} aria-label="Remove set"><Trash2 size={13} className="text-ink-3" /></button>
              </div>
            ))}
            <button className="text-[11px] font-bold text-lavender" onClick={() => setEx(i, { ...ex, sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] ?? { reps: 8, kg: 0 }) }] })}>+ Add set</button>
          </div>
        ))}
        <Pill className="w-full" onClick={() => setF({ ...f, exercises: [...f.exercises, { name: '', sets: [{ reps: 8, kg: 0 }] }] })}><Plus size={15} /> Exercise</Pill>
        <Field label="Notes"><textarea rows={2} className="field" value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete('this workout')) { remove('workouts', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.exercises.some(e => e.name.trim() && e.sets.some(s => s.reps > 0))}
            onClick={() => { save('workouts', { ...f, exercises: f.exercises.filter(e => e.name.trim()).map(e => ({ ...e, name: e.name.trim(), sets: e.sets.filter(s => s.reps > 0) })) }); onClose() }}>Save session</Pill>
        </div>
      </div>
    </Sheet>
  )
}
