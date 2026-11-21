import { AnimatePresence, motion, useMotionValue } from 'framer-motion'
import { AlertTriangle, Copy, Lock, Pencil, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, CATEGORY_COLOR, CatIcon, Field, Pill, ScreenHeader, Segmented, Sheet, confirmDelete } from '../components/ui'
import { ConflictNote } from '../components/TaskSheets'
import { useDay, useNow } from '../lib/hooks'
import { conflictsWith, detectConflicts } from '../lib/schedule'
import { dateKey, fmt12, fmtRange, fromMin, toMin, uid } from '../lib/time'
import type { ActivityInstance, Category, ScheduleBlock } from '../lib/types'
import { useStore } from '../store/useStore'

const PX = 1.8 // px per minute (15-min blocks stay legible)
const DAY_START = 4 * 60 + 30
const DAY_END = 22 * 60 + 30
const SNAP = 15

export default function Timetable() {
  const now = useNow(30000)
  const today = dateKey(now)
  const [mode, setMode] = useState<'day' | 'weekday' | 'weekend'>('day')
  const templates = useStore(s => s.templates)
  const { items } = useDay(today, now)
  const reschedule = useStore(s => s.reschedule)
  const upsertBlock = useStore(s => s.upsertBlock)
  const copyTemplate = useStore(s => s.copyTemplate)
  const resetDay = useStore(s => s.resetDay)
  const resetTemplate = useStore(s => s.resetTemplate)
  const overrides = useStore(s => s.overrides)
  // Locked by default so scrolling never moves a block by accident.
  const [editing, setEditing] = useState(false)
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 7000); return () => clearTimeout(t) }, [undo])
  useEffect(() => { setEditing(false) }, [mode])
  const [edit, setEdit] = useState<{ tid: string; block: ScheduleBlock; isNew: boolean } | null>(null)

  const tpl = templates.find(t => t.kind === (mode === 'weekend' ? 'weekend' : 'weekday'))!
  const blocks: (ScheduleBlock & { inst?: ActivityInstance })[] = mode === 'day'
    ? items.filter(i => i.status !== 'moved').map(i => ({ ...i, inst: i }))
    : tpl.blocks
  const conflicts = useMemo(() => detectConflicts(blocks), [blocks])
  const conflictIds = new Set(conflicts.flatMap(c => [c.a.id, c.b.id]))
  const nowM = now.getHours() * 60 + now.getMinutes()

  const onDrop = (b: ScheduleBlock & { inst?: ActivityInstance }, deltaMin: number) => {
    const d = Math.round(deltaMin / SNAP) * SNAP
    if (!d) return
    const s = Math.min(Math.max(toMin(b.start) + d, 0), 23 * 60 + 45)
    const dur = b.end ? toMin(b.end) - toMin(b.start) : 0
    const ns = fromMin(s), ne = b.end ? fromMin(Math.min(s + dur, 23 * 60 + 59)) : undefined
    // Snapshot so the move can be undone exactly (including "no change existed").
    const st = useStore.getState()
    const prevOverrides = st.overrides
    const prevTemplates = st.templates
    if (mode === 'day' && b.inst) reschedule(b.inst, ns, ne)
    else upsertBlock(tpl.id, { ...b, start: ns, end: ne })
    setUndo({
      label: `${b.title} → ${fmt12(ns)}`,
      restore: () => useStore.setState(mode === 'day' ? { overrides: prevOverrides } : { templates: prevTemplates }),
    })
  }

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="Drag blocks to move · 15-min snap" title="Timetable"
        right={mode !== 'day' ? <Pill variant="lavender" className="h-9" onClick={() => setEdit({ tid: tpl.id, isNew: true, block: { id: `b-${uid().slice(0, 8)}`, title: '', category: 'Personal', start: '10:00', end: '10:30' } })}><Plus size={16} /></Pill> : undefined} />
      <Segmented value={mode} onChange={setMode} options={[{ v: 'day', l: 'Today only' }, { v: 'weekday', l: 'Weekdays' }, { v: 'weekend', l: 'Weekends' }]} />
      <p className="text-xs text-ink-2">
        {mode === 'day' ? 'Moves here change today only — your master template and past records stay intact.'
          : 'Editing the master template affects future days. Completed history is never rewritten.'}
      </p>
      <div className="flex gap-2">
        <Pill variant={editing ? 'lavender' : 'glass'} className="flex-1 h-10" onClick={() => setEditing(v => !v)}>
          {editing ? <><Lock size={15} /> Done editing</> : <><Pencil size={15} /> Edit times</>}
        </Pill>
        {mode === 'day' ? (
          <Pill className="flex-1 h-10" disabled={!overrides.some(o => o.date === today)}
            onClick={() => { if (window.confirm("Undo all of today's time changes and go back to your normal schedule?")) { resetDay(today); setUndo(null) } }}>
            <RotateCcw size={15} /> Reset today
          </Pill>
        ) : (
          <Pill className="flex-1 h-10"
            onClick={() => { if (window.confirm(`Restore the ${mode === 'weekend' ? 'weekend' : 'weekday'} template to your original 5:00 AM – 9:30 PM schedule? Your completed history is kept.`)) { resetTemplate(tpl.id); setUndo(null) } }}>
            <RotateCcw size={15} /> Restore original
          </Pill>
        )}
      </div>
      {editing && <div className="text-[11px] text-lavender text-center -mt-1">Drag a block up or down to move it · tap Done when finished</div>}
      {mode === 'weekend' && (
        <Pill className="h-8 text-xs" onClick={() => { if (window.confirm('Replace the weekend template with a copy of the weekday template?')) copyTemplate('tpl-weekday', 'tpl-weekend') }}>
          <Copy size={14} /> Copy weekday → weekend
        </Pill>
      )}
      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <div>
            <div className="font-bold">{conflicts.length} overlapping {conflicts.length === 1 ? 'pair' : 'pairs'}</div>
            {conflicts.slice(0, 4).map((c, i) => <div key={i}>{c.a.title} ↔ {c.b.title}</div>)}
          </div>
        </div>
      )}

      <div className="relative glass rounded-[22px] overflow-hidden" style={{ height: (DAY_END - DAY_START) * PX + 16 }}>
        {Array.from({ length: Math.ceil((DAY_END - DAY_START) / 60) + 1 }, (_, i) => {
          const m = Math.ceil(DAY_START / 60) * 60 + i * 60
          if (m > DAY_END) return null
          return (
            <div key={m} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: (m - DAY_START) * PX + 8 }}>
              <span className="w-12 text-right text-[10px] font-semibold text-ink-3 -translate-y-1/2">{fmt12(fromMin(m)).replace(':00', '')}</span>
              <span className="flex-1 h-px bg-white/5" />
            </div>
          )
        })}
        {mode === 'day' && nowM > DAY_START && nowM < DAY_END && (
          <div className="absolute left-12 right-2 h-0.5 bg-peach z-20 rounded-full" style={{ top: (nowM - DAY_START) * PX + 8 }}>
            <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-peach" />
          </div>
        )}
        {blocks.map(b => (
          <DragBlock key={b.id} b={b} locked={!editing} conflict={conflictIds.has(b.id)} onDrop={d => onDrop(b, d)}
            onTap={() => mode !== 'day' && setEdit({ tid: tpl.id, block: b, isNew: false })} />
        ))}
      </div>

      <BlockSheet edit={edit} others={tpl.blocks} onClose={() => setEdit(null)} />

      <AnimatePresence>
        {undo && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            className="fixed z-50 left-1/2 -translate-x-1/2 bottom-[calc(max(14px,env(safe-area-inset-bottom))+78px)] w-[calc(100%-32px)] max-w-[440px] rounded-2xl bg-[#241c3e] border border-lavender/30 shadow-[0_12px_30px_rgba(0,0,0,.5)] px-4 py-3 flex items-center gap-3">
            <span className="flex-1 text-sm font-semibold truncate">Moved {undo.label}</span>
            <button onClick={() => { undo.restore(); setUndo(null) }} className="flex items-center gap-1.5 text-sm font-bold text-lavender"><Undo2 size={16} /> Undo</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DragBlock({ b, conflict, locked, onDrop, onTap }: { b: ScheduleBlock & { inst?: ActivityInstance }; conflict: boolean; locked: boolean; onDrop: (deltaMin: number) => void; onTap: () => void }) {
  const y = useMotionValue(0)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(0)
  const moved = useRef(false)
  const s = toMin(b.start), e = b.end ? toMin(b.end) : s + 15
  const h = Math.max(22, (e - s) * PX - 3)
  const status = b.inst?.status
  const snapPreview = Math.round(preview / PX / SNAP) * SNAP
  return (
    <motion.div
      drag={locked ? false : 'y'} dragMomentum={false} style={{ y, top: (s - DAY_START) * PX + 8, height: h }}
      onDragStart={() => { setDragging(true); moved.current = true }}
      onDrag={() => setPreview(y.get())}
      onDragEnd={() => { setDragging(false); onDrop(y.get() / PX); y.set(0); setPreview(0); setTimeout(() => (moved.current = false), 50) }}
      onTap={() => { if (!moved.current) onTap() }}
      whileDrag={{ scale: 1.03, zIndex: 30, boxShadow: '0 12px 30px rgba(0,0,0,.5)' }}
      className={`absolute left-14 right-2 rounded-xl px-2.5 py-1 flex items-start gap-2 overflow-hidden ${locked ? '' : 'cursor-grab active:cursor-grabbing touch-none ring-1 ring-lavender/25'} select-none ${status === 'done' ? 'opacity-55' : ''}`}
      title={b.title}
    >
      <div className="absolute inset-0 rounded-xl" style={{ background: `${CATEGORY_COLOR[b.category]}1c`, border: `1px solid ${conflict ? '#FFCF7A' : `${CATEGORY_COLOR[b.category]}44`}` }} />
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: CATEGORY_COLOR[b.category] }} />
      <CatIcon c={b.category} size={13} className="relative mt-[3px] shrink-0" />
      <div className="relative min-w-0 flex-1 leading-tight">
        <div className="text-[12px] font-semibold truncate">{b.title}</div>
        {h > 34 && <div className="text-[10px] text-ink-2 truncate">
          {dragging ? `→ ${fmtRange(fromMin(s + snapPreview), b.end ? fromMin(e + snapPreview) : undefined)}` : fmtRange(b.start, b.end)}
          {status && status !== 'upcoming' && !dragging ? ` · ${status}` : ''}
        </div>}
      </div>
      {dragging && h <= 34 && <span className="relative text-[10px] font-bold text-peach">{fmt12(fromMin(s + snapPreview))}</span>}
    </motion.div>
  )
}

function BlockSheet({ edit, others, onClose }: { edit: { tid: string; block: ScheduleBlock; isNew: boolean } | null; others: ScheduleBlock[]; onClose: () => void }) {
  const upsertBlock = useStore(s => s.upsertBlock)
  const removeBlock = useStore(s => s.removeBlock)
  const [f, setF] = useState<ScheduleBlock | null>(null)
  const [checklist, setChecklist] = useState('')
  if (edit && f?.id !== edit.block.id) { setF(edit.block); setChecklist((edit.block.checklist ?? []).join('\n')) }
  if (!edit || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const hits = conflictsWith(f, others)
  const invalid = !f.title.trim() || (!!f.end && toMin(f.end) <= toMin(f.start))
  return (
    <Sheet open onClose={onClose} title={edit.isNew ? 'New block' : 'Edit block'}>
      <div className="space-y-3">
        <Field label="Title"><input className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Category">
          <select className="field" value={f.category} onChange={e => setF({ ...f, category: e.target.value as Category })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" className="field" value={f.start} onChange={e => e.target.value && setF({ ...f, start: e.target.value })} /></Field>
          <Field label="End (blank = point in time)"><input type="time" className="field" value={f.end ?? ''} onChange={e => setF({ ...f, end: e.target.value || undefined })} /></Field>
        </div>
        <Field label="Focus preset (minutes, optional)"><input type="number" className="field" value={f.focusMinutes ?? ''} onChange={e => setF({ ...f, focusMinutes: e.target.value ? Number(e.target.value) : undefined })} /></Field>
        <Field label="Description"><input className="field" value={f.description ?? ''} onChange={e => setF({ ...f, description: e.target.value || undefined })} /></Field>
        <Field label="Checklist (one per line)"><textarea rows={3} className="field" value={checklist} onChange={e => setChecklist(e.target.value)} /></Field>
        <ConflictNote hits={hits} />
        <div className="flex gap-2">
          {!edit.isNew && <Pill variant="danger" onClick={() => { if (confirmDelete(`"${f.title}" from the template`)) { removeBlock(edit.tid, f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={invalid}
            onClick={() => { upsertBlock(edit.tid, { ...f, title: f.title.trim(), checklist: checklist.split('\n').map(x => x.trim()).filter(Boolean) }); onClose() }}>Save</Pill>
        </div>
      </div>
    </Sheet>
  )
}
