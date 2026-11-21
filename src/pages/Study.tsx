import { Check, Plus, RotateCw, Timer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Bar, Card, Empty, Field, MiniBars, Pill, ScreenHeader, Section, Segmented, Sheet, Stat, confirmDelete } from '../components/ui'
import { focusMinutes, lastNDays } from '../lib/analytics'
import { dateKey, fmtDur, prettyDate, uid, weekdayShort, weekOf } from '../lib/time'
import type { PracticeAnswer, StudySubject } from '../lib/types'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'

export default function Study() {
  const s = useStore()
  const openFocus = useNav(n => n.openFocus)
  const [tab, setTab] = useState<'subjects' | 'practice' | 'history'>('subjects')
  const [subj, setSubj] = useState<StudySubject | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [pa, setPa] = useState<PracticeAnswer | null>(null)
  const today = dateKey()
  const subjects = s.subjects.filter(x => !x.archived)
  const minutesOn = (d: string) => s.studySessions.filter(x => x.date === d).reduce((a, x) => a + x.minutes, 0) + focusMinutes(s, d, c => c === 'Education')
  const weekMin = weekOf(today).reduce((a, d) => a + minutesOn(d), 0)
  const scores = s.practice.filter(p => p.score !== undefined)
  const avg = scores.length ? (scores.reduce((a, p) => a + (p.score ?? 0), 0) / scores.length).toFixed(1) : '—'

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="NIOS · 6:15–7:15 AM daily" title="Study Tracker" />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="This week" value={fmtDur(weekMin)} />
        <Stat label="Today" value={fmtDur(minutesOn(today))} accent="#FFB59A" />
        <Stat label="Avg score" value={avg} sub="out of 10" accent="#C9B8FF" />
      </div>
      <div className="flex gap-2">
        <Pill variant="white" className="flex-1 h-11" onClick={() => openFocus({ label: 'NIOS study session', category: 'Education', minutes: 60, instanceKey: `${today}:study` })}><Timer size={16} /> 60-min timer</Pill>
        <Pill className="flex-1 h-11" onClick={() => setLogOpen(true)}><Plus size={16} /> Log session</Pill>
      </div>
      <Segmented value={tab} onChange={setTab} options={[{ v: 'subjects', l: 'Subjects' }, { v: 'practice', l: 'Practice' }, { v: 'history', l: 'History' }]} />

      {tab === 'subjects' && (
        <div className="space-y-2">
          {subjects.map(x => {
            const done = x.chapters.filter(c => c.done).length
            return (
              <Card key={x.id} onClick={() => setSubj(x)} className="space-y-2">
                <div className="flex justify-between"><span className="font-semibold">{x.name}</span><span className="text-xs text-ink-3">{done}/{x.chapters.length} chapters</span></div>
                <Bar pct={x.chapters.length ? (done / x.chapters.length) * 100 : 0} />
              </Card>
            )
          })}
          <Pill className="w-full" onClick={() => { const name = window.prompt('Subject name'); if (name?.trim()) s.save('subjects', { id: uid(), name: name.trim(), chapters: [] }) }}><Plus size={16} /> Add subject</Pill>
        </div>
      )}

      {tab === 'practice' && (
        <div className="space-y-2">
          <Pill variant="lavender" className="w-full" onClick={() => setPa({ id: uid(), date: today, subjectId: subjects[0]?.id ?? '', question: '', answer: '', createdAt: Date.now() })}><Plus size={16} /> New practice answer</Pill>
          <p className="text-xs text-ink-2">Strict grading out of 10: note each deduction and how to improve. Grade yourself honestly, or paste an examiner's/AI assessment.</p>
          {s.practice.length === 0 ? <Empty title="No practice answers yet" /> :
            [...s.practice].sort((a, b) => b.createdAt - a.createdAt).map(p => (
              <Card key={p.id} onClick={() => setPa(p)} className="space-y-1">
                <div className="flex justify-between gap-2"><span className="text-sm font-semibold line-clamp-2">{p.question || 'Untitled question'}</span>
                  {p.score !== undefined && <span className={`text-lg font-extrabold ${p.score >= 7 ? 'text-success' : p.score >= 5 ? 'text-warning' : 'text-danger'}`}>{p.score}/10</span>}</div>
                <div className="text-xs text-ink-3">{s.subjects.find(x => x.id === p.subjectId)?.name} · {prettyDate(p.date)}</div>
              </Card>
            ))}
        </div>
      )}

      {tab === 'history' && (
        <>
          <Section title="Last 14 days (minutes)">
            <Card><MiniBars data={lastNDays(14).map(d => ({ label: weekdayShort(d)[0], value: minutesOn(d), highlight: d === today }))} /></Card>
          </Section>
          <div className="space-y-2">
            {[...s.studySessions].sort((a, b) => b.createdAt - a.createdAt).map(x => {
              const sub = s.subjects.find(y => y.id === x.subjectId)
              return (
                <div key={x.id} className="glass rounded-[18px] px-3.5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{sub?.name}{x.chapterId ? ` · ${sub?.chapters.find(c => c.id === x.chapterId)?.name ?? ''}` : ''}</div>
                    <div className="text-xs text-ink-3 truncate">{prettyDate(x.date)}{x.topics ? ` · ${x.topics}` : ''}</div>
                  </div>
                  <span className="text-sm font-bold">{fmtDur(x.minutes)}</span>
                  <button onClick={() => confirmDelete('this session') && s.remove('studySessions', x.id)} aria-label="Delete"><Trash2 size={14} className="text-ink-3" /></button>
                </div>
              )
            })}
            {s.studySessions.length === 0 && <Empty title="No sessions logged" hint="Focus-timer study sessions also count toward your totals." />}
          </div>
        </>
      )}

      <SubjectSheet subject={subj} onClose={() => setSubj(null)} />
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
      <PracticeSheet p={pa} onClose={() => setPa(null)} />
    </div>
  )
}

function SubjectSheet({ subject, onClose }: { subject: StudySubject | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const live = useStore(s => s.subjects.find(x => x.id === subject?.id))
  const [ch, setCh] = useState('')
  if (!subject || !live) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const upd = (chapters: StudySubject['chapters']) => save('subjects', { ...live, chapters })
  return (
    <Sheet open onClose={onClose} title={live.name}>
      <div className="space-y-2">
        {live.chapters.map(c => (
          <div key={c.id} className="glass rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <button onClick={() => upd(live.chapters.map(x => (x.id === c.id ? { ...x, done: !x.done } : x)))}
              className={`size-5 rounded-md grid place-items-center border ${c.done ? 'bg-lavender border-lavender' : 'border-white/25'}`}>{c.done && <Check size={12} strokeWidth={3} color="#1B1430" />}</button>
            <span className={`flex-1 text-sm ${c.done ? 'text-ink-2' : ''}`}>{c.name}</span>
            <button onClick={() => upd(live.chapters.map(x => (x.id === c.id ? { ...x, revisions: x.revisions + 1 } : x)))} className="flex items-center gap-1 text-xs font-bold text-peach glass rounded-full px-2 h-7">
              <RotateCw size={12} /> {c.revisions}
            </button>
            <button onClick={() => confirmDelete(c.name) && upd(live.chapters.filter(x => x.id !== c.id))} aria-label="Delete"><Trash2 size={14} className="text-ink-3" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input className="field flex-1" placeholder="Add chapter" value={ch} onChange={e => setCh(e.target.value)} />
          <Pill onClick={() => { if (ch.trim()) { upd([...live.chapters, { id: uid(), name: ch.trim(), done: false, revisions: 0 }]); setCh('') } }}><Plus size={16} /></Pill>
        </div>
        <p className="text-xs text-ink-3">Tap ↻ each time you revise a chapter.</p>
        <div className="flex gap-2 pt-2">
          <Pill className="flex-1" onClick={() => { const n = window.prompt('Rename subject', live.name); if (n?.trim()) save('subjects', { ...live, name: n.trim() }) }}>Rename</Pill>
          <Pill className="flex-1" onClick={() => { if (window.confirm('Archive this subject? History is kept.')) { save('subjects', { ...live, archived: true }); onClose() } }}>Archive</Pill>
        </div>
      </div>
    </Sheet>
  )
}

function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const allSubjects = useStore(s => s.subjects)
  const subjects = allSubjects.filter(x => !x.archived)
  const save = useStore(s => s.save)
  const [f, setF] = useState({ subjectId: '', chapterId: '', minutes: '60', topics: '', notes: '', date: dateKey() })
  const sub = subjects.find(x => x.id === (f.subjectId || subjects[0]?.id))
  return (
    <Sheet open={open} onClose={onClose} title="Log study session">
      <div className="space-y-3">
        <Field label="Subject"><select className="field" value={sub?.id} onChange={e => setF({ ...f, subjectId: e.target.value, chapterId: '' })}>{subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        {sub && sub.chapters.length > 0 && <Field label="Chapter"><select className="field" value={f.chapterId} onChange={e => setF({ ...f, chapterId: e.target.value })}><option value="">—</option>{sub.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes"><input type="number" className="field" value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className="field" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Topics completed"><input className="field" value={f.topics} onChange={e => setF({ ...f, topics: e.target.value })} /></Field>
        <Field label="Notes"><textarea rows={2} className="field" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        <Pill variant="lavender" className="w-full h-12" disabled={!sub || !(Number(f.minutes) > 0)} onClick={() => {
          save('studySessions', { id: uid(), date: f.date, subjectId: sub!.id, chapterId: f.chapterId || undefined, minutes: Number(f.minutes), topics: f.topics || undefined, notes: f.notes || undefined, createdAt: Date.now() })
          onClose()
        }}>Save session</Pill>
      </div>
    </Sheet>
  )
}

function PracticeSheet({ p, onClose }: { p: PracticeAnswer | null; onClose: () => void }) {
  const allSubjects = useStore(s => s.subjects)
  const subjects = allSubjects.filter(x => !x.archived)
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!p && s.practice.some(x => x.id === p.id))
  const [f, setF] = useState<PracticeAnswer | null>(p)
  if (p && f?.id !== p.id) setF(p)
  if (!p || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  return (
    <Sheet open onClose={onClose} title="Practice answer">
      <div className="space-y-3">
        <Field label="Subject"><select className="field" value={f.subjectId} onChange={e => setF({ ...f, subjectId: e.target.value })}>{subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Question"><textarea rows={2} className="field" value={f.question} onChange={e => setF({ ...f, question: e.target.value })} /></Field>
        <Field label="Your answer"><textarea rows={5} className="field" value={f.answer} onChange={e => setF({ ...f, answer: e.target.value })} /></Field>
        <Field label={`Score: ${f.score ?? '—'} / 10`}>
          <div className="flex gap-1">{Array.from({ length: 11 }, (_, i) => (
            <button key={i} onClick={() => setF({ ...f, score: i })} className={`flex-1 h-8 rounded-lg text-xs font-bold ${f.score === i ? 'bg-lavender text-purple-deep' : 'glass text-ink-2'}`}>{i}</button>
          ))}</div>
        </Field>
        <Field label="Deductions (what cost marks)"><textarea rows={3} className="field" placeholder="−1 missing definition, −0.5 no example…" value={f.deductions ?? ''} onChange={e => setF({ ...f, deductions: e.target.value })} /></Field>
        <Field label="Improvement suggestions"><textarea rows={3} className="field" value={f.improvements ?? ''} onChange={e => setF({ ...f, improvements: e.target.value })} /></Field>
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete('this answer')) { remove('practice', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.question.trim() || !f.subjectId} onClick={() => { save('practice', f); onClose() }}>Save</Pill>
        </div>
      </div>
    </Sheet>
  )
}
