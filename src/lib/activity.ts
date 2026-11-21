import type { Data } from '../store/useStore'
import type { Category } from './types'
import { dateKey } from './time'

/** One recorded thing the user actually did. Built only from stored records — never inferred. */
export interface ActivityEvent {
  ts: number
  date: string
  hour: number
  category: Category | 'Task'
  kind: 'task' | 'focus' | 'study' | 'reading' | 'manifest' | 'journal' | 'trade' | 'outreach' | 'lead'
  label: string
  minutes?: number
  count?: number
  /** finer content tag: recording/scripting vs editing */
  tag?: 'creation' | 'editing'
}

const EDIT_RE = /edit/i
const CREATE_RE = /record|content creat|script|shoot|reel/i
const contentTag = (blockIdOrLabel: string, cat?: string): ActivityEvent['tag'] =>
  /(^|-)edit$/.test(blockIdOrLabel) || EDIT_RE.test(blockIdOrLabel) ? 'editing'
    : blockIdOrLabel === 'record' || blockIdOrLabel === 'we-content' || CREATE_RE.test(blockIdOrLabel) || cat === 'Content' ? 'creation' : undefined

const ev = (ts: number, e: Omit<ActivityEvent, 'ts' | 'date' | 'hour'>): ActivityEvent => {
  const d = new Date(ts)
  return { ts, date: dateKey(d), hour: d.getHours(), ...e }
}

export function activityEvents(data: Data): ActivityEvent[] {
  const out: ActivityEvent[] = []
  for (const c of Object.values(data.completions)) {
    if (c.status !== 'done') continue
    // Use the actual completion time, but keep it on the scheduled date (late "complete now" still belongs to its day)
    const at = new Date(c.at)
    const ts = dateKey(at) === c.date ? c.at : new Date(`${c.date}T${c.scheduledStart}:00`).getTime()
    out.push(ev(ts, { category: c.category, kind: 'task', label: c.title, count: 1, tag: c.category === 'Content' ? (contentTag(c.blockId) ?? contentTag(c.title, c.category)) : undefined }))
  }
  for (const f of data.focusSessions) out.push(ev(f.startedAt, { category: f.category, kind: 'focus', label: `Focus · ${f.label}`, minutes: f.actualMinutes, tag: f.category === 'Content' ? contentTag(f.label, f.category) : undefined }))
  for (const c of data.content) out.push(ev(c.createdAt, { category: 'Content', kind: 'task', label: `Content idea · ${c.title}`, tag: 'creation' }))
  for (const s of data.studySessions) out.push(ev(s.createdAt, { category: 'Education', kind: 'study', label: 'Study session logged', minutes: s.minutes }))
  for (const r of data.readingSessions) out.push(ev(r.createdAt, { category: 'Reading', kind: 'reading', label: `Read pp. ${r.pagesFrom}–${r.pagesTo}`, minutes: r.minutes }))
  for (const m of data.manifestations) if (m.done) out.push(ev(m.at, { category: 'Mindset', kind: 'manifest', label: `${m.slot[0].toUpperCase()}${m.slot.slice(1)} manifestation` }))
  for (const j of Object.values(data.journal)) out.push(ev(j.updatedAt, { category: 'Reflection', kind: 'journal', label: 'Journal entry' }))
  for (const t of data.trades) out.push(ev(t.createdAt, { category: 'Trading', kind: 'trade', label: `${t.kind === 'paper' ? 'Paper' : 'Real'} trade · ${t.instrument}` }))
  for (const l of data.leads) out.push(ev(l.createdAt, { category: 'Business', kind: 'lead', label: `Lead · ${l.businessName}` }))
  for (const s of Object.values(data.sales)) {
    const n = s.calls + s.dms
    if (n) out.push(ev(new Date(`${s.date}T13:00:00`).getTime(), { category: 'Business', kind: 'outreach', label: `${s.calls} calls · ${s.dms} DMs`, count: n }))
  }
  return out.sort((a, b) => a.ts - b.ts)
}

export type Metric = 'all' | 'tasks' | 'focus' | 'creation' | 'editing' | Category

export const METRICS: { v: Metric; l: string; unit: string }[] = [
  { v: 'all', l: 'All activity', unit: 'contributions' },
  { v: 'tasks', l: 'Tasks done', unit: 'tasks done' },
  { v: 'focus', l: 'Focus time', unit: 'focus minutes' },
  { v: 'Education', l: 'Study', unit: 'study contributions' },
  { v: 'Development', l: 'Dev', unit: 'dev contributions' },
  { v: 'Business', l: 'Business', unit: 'business contributions' },
  { v: 'Fitness', l: 'Fitness', unit: 'fitness contributions' },
  { v: 'Reading', l: 'Reading', unit: 'reading contributions' },
  { v: 'creation', l: 'Content creation', unit: 'content creation sessions' },
  { v: 'editing', l: 'Video editing', unit: 'video editing sessions' },
  { v: 'Mindset', l: 'Mindset', unit: 'mindset contributions' },
  { v: 'Trading', l: 'Trading', unit: 'trading contributions' },
]

/** Value an event contributes under a metric (0 = not counted). */
export function weight(e: ActivityEvent, m: Metric): number {
  if (m === 'all') return e.count ?? 1
  if (m === 'tasks') return e.kind === 'task' && !e.label.startsWith('Content idea') ? 1 : 0
  if (m === 'focus') return e.kind === 'focus' ? e.minutes ?? 0 : 0
  if (m === 'creation' || m === 'editing') return e.tag === m ? 1 : 0
  return e.category === m ? (e.kind === 'focus' ? 1 : e.count ?? 1) : 0
}

/** GitHub-style 0–4 level relative to the busiest cell in view. */
export function level(v: number, max: number) {
  if (!v || !max) return 0
  const r = v / max
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1
}

export const LEVEL_COLORS = ['rgb(255 255 255 / 0.055)', '#4a2e47', '#8c4a63', '#E07A8C', '#FFC4AE']
