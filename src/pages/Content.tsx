import { ExternalLink, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, Field, Pill, ScreenHeader, Section, Segmented, Sheet, confirmDelete } from '../components/ui'
import { useDay, useNow } from '../lib/hooks'
import { dateKey, fmtRange, prettyDate, uid } from '../lib/time'
import type { ContentItem, ContentStatus, ResearchItem } from '../lib/types'
import { useStore } from '../store/useStore'

const STATUSES: ContentStatus[] = ['Idea', 'Scripted', 'Recorded', 'Edited', 'Scheduled', 'Published']
const SC: Record<ContentStatus, string> = { Idea: '#9A98AE', Scripted: '#8FB8FF', Recorded: '#FFCF7A', Edited: '#FF9ECF', Scheduled: '#C9B8FF', Published: '#9BE7C4' }

export function ContentStudio() {
  const content = useStore(s => s.content)
  const now = useNow(60000)
  const { items } = useDay(dateKey(now), now)
  const [filter, setFilter] = useState<'pipeline' | 'published'>('pipeline')
  const [edit, setEdit] = useState<ContentItem | null>(null)
  const rec = items.find(i => i.id === 'record'), ed = items.find(i => i.id === 'edit')
  const list = content.filter(c => (filter === 'published' ? c.status === 'Published' : c.status !== 'Published'))
    .sort((a, b) => STATUSES.indexOf(b.status) - STATUSES.indexOf(a.status))
  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="Reels · scripts · publishing" title="Content Studio"
        right={<Pill variant="lavender" className="h-9" onClick={() => setEdit({ id: uid(), title: '', format: 'Reel', status: 'Idea', createdAt: Date.now() })}><Plus size={16} /> Idea</Pill>} />
      <div className="grid grid-cols-2 gap-2">
        {[['Recording', rec], ['Editing', ed]].map(([l, i]) => {
          const it = i as typeof rec
          return (
            <Card key={l as string} className="space-y-0.5">
              <div className="text-[11px] font-semibold text-ink-2">{l as string} today</div>
              <div className="text-sm font-bold">{it ? fmtRange(it.start, it.end) : 'Not scheduled'}</div>
              <div className="text-[11px] text-ink-3">{it?.rescheduled ? 'Changed for today only' : it ? it.status : ''}</div>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-ink-3">To move recording/editing for a single day, drag it in Timetable → “Today only”. The master schedule stays at 3:15 and 4:00.</p>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {STATUSES.map(s => <span key={s} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${SC[s]}1f`, color: SC[s] }}>{s} {content.filter(c => c.status === s).length}</span>)}
      </div>
      <Segmented value={filter} onChange={setFilter} options={[{ v: 'pipeline', l: 'In progress' }, { v: 'published', l: 'Published' }]} />
      {list.length === 0 ? <Empty title={filter === 'published' ? 'Nothing published yet' : 'No content ideas yet'} hint="Capture reel ideas, write scripts, then move them through recording → editing → publishing." /> :
        list.map(c => (
          <Card key={c.id} onClick={() => setEdit(c)} className="flex items-center gap-3">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: SC[c.status] }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{c.title}</div>
              <div className="text-xs text-ink-3">{c.format} · {c.status}{c.publishDate ? ` · ${prettyDate(c.publishDate)}` : ''}</div>
            </div>
          </Card>
        ))}
      <ContentSheet c={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function ContentSheet({ c, onClose }: { c: ContentItem | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!c && s.content.some(x => x.id === c.id))
  const [f, setF] = useState<ContentItem | null>(c)
  if (c && f?.id !== c.id) setF(c)
  if (!c || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  return (
    <Sheet open onClose={onClose} title={exists ? 'Content' : 'New idea'}>
      <div className="space-y-3">
        <Field label="Title / hook"><input className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Format"><select className="field" value={f.format} onChange={e => setF({ ...f, format: e.target.value as ContentItem['format'] })}>{['Reel', 'Post', 'Story', 'Video'].map(x => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Status">
          <div className="flex flex-wrap gap-1.5">{STATUSES.map(s => <button key={s} onClick={() => setF({ ...f, status: s })} className={`h-8 px-3 rounded-full text-xs font-bold ${f.status === s ? 'text-on-peach' : 'glass text-ink-2'}`} style={f.status === s ? { background: SC[s] } : undefined}>{s}</button>)}</div>
        </Field>
        <Field label="Script"><textarea rows={6} className="field" value={f.script ?? ''} onChange={e => setF({ ...f, script: e.target.value })} /></Field>
        <Field label="Publish date"><input type="date" className="field" value={f.publishDate ?? ''} onChange={e => setF({ ...f, publishDate: e.target.value || undefined })} /></Field>
        <Field label="Performance notes"><textarea rows={2} className="field" placeholder="Views, saves, what worked…" value={f.performance ?? ''} onChange={e => setF({ ...f, performance: e.target.value })} /></Field>
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete(f.title || 'this item')) { remove('content', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.title.trim()} onClick={() => { save('content', f); onClose() }}>Save</Pill>
        </div>
      </div>
    </Sheet>
  )
}

export function ResearchLibrary() {
  const research = useStore(s => s.research)
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<ResearchItem | null>(null)
  const list = [...research].filter(r => !q || `${r.title} ${r.tags ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.createdAt - a.createdAt)
  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="11:30 AM – 12:30 PM" title="Research Library"
        right={<Pill variant="lavender" className="h-9" onClick={() => setEdit({ id: uid(), title: '', date: dateKey(), createdAt: Date.now() })}><Plus size={16} /></Pill>} />
      <div className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className="field !pl-10" placeholder="Search notes, tags, links" value={q} onChange={e => setQ(e.target.value)} /></div>
      <Section title={`${list.length} items`}>
        {list.length === 0 ? <Empty title="Nothing saved yet" hint="Save links, findings and ideas from your research hour." /> : list.map(r => (
          <Card key={r.id} onClick={() => setEdit(r)} className="space-y-1">
            <div className="flex justify-between gap-2"><span className="text-sm font-semibold">{r.title}</span>
              {r.url && <a href={r.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} aria-label="Open link"><ExternalLink size={15} className="text-lavender" /></a>}</div>
            {r.notes && <div className="text-xs text-ink-2 line-clamp-2">{r.notes}</div>}
            <div className="text-[11px] text-ink-3">{prettyDate(r.date)}{r.tags ? ` · ${r.tags}` : ''}</div>
          </Card>
        ))}
      </Section>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Research item">
        {edit && (
          <div className="space-y-3">
            <Field label="Title"><input className="field" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Link"><input className="field" inputMode="url" value={edit.url ?? ''} onChange={e => setEdit({ ...edit, url: e.target.value })} /></Field>
            <Field label="Tags"><input className="field" placeholder="ai, crm, marketing" value={edit.tags ?? ''} onChange={e => setEdit({ ...edit, tags: e.target.value })} /></Field>
            <Field label="Notes"><textarea rows={5} className="field" value={edit.notes ?? ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <div className="flex gap-2">
              {research.some(r => r.id === edit.id) && <Pill variant="danger" onClick={() => { if (confirmDelete(edit.title)) { remove('research', edit.id); setEdit(null) } }}><Trash2 size={16} /></Pill>}
              <Pill variant="lavender" className="flex-1" disabled={!edit.title.trim()} onClick={() => { save('research', edit); setEdit(null) }}>Save</Pill>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
