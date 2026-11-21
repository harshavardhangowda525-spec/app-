import { Archive, BookOpen, Flame, Plus, Timer } from 'lucide-react'
import { useState } from 'react'
import { Bar, Card, Empty, Field, Pill, ScreenHeader, Section, Sheet, Stat } from '../components/ui'
import { streak } from '../lib/analytics'
import { dateKey, fmtDur, prettyDate, uid } from '../lib/time'
import type { Book, ReadingSession } from '../lib/types'
import { useNav } from '../store/nav'
import { useStore } from '../store/useStore'

export default function Reading() {
  const s = useStore()
  const openFocus = useNav(n => n.openFocus)
  const [bookEdit, setBookEdit] = useState<Book | null>(null)
  const [logBook, setLogBook] = useState<Book | null>(null)
  const today = dateKey()
  const reading = s.books.filter(b => b.status === 'reading')
  const others = s.books.filter(b => b.status !== 'reading')
  const st = streak(d => s.readingSessions.some(r => r.date === d) || ['read-am', 'read-pm'].some(id => s.completions[`${d}:${id}`]?.status === 'done'))
  const pagesWeek = s.readingSessions.filter(r => r.date > dateKey(new Date(Date.now() - 7 * 864e5))).reduce((a, r) => a + Math.max(0, r.pagesTo - r.pagesFrom), 0)

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="5:15 AM & 8:00 PM" title="Reading" right={<Pill variant="lavender" className="h-9" onClick={() => setBookEdit({ id: uid(), title: '', totalPages: 200, currentPage: 0, slot: 'any', status: 'reading', createdAt: Date.now() })}><Plus size={16} /> Book</Pill>} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Streak" value={<span className="flex items-center gap-1"><Flame size={18} className="text-peach" />{st}</span>} />
        <Stat label="Pages · 7d" value={pagesWeek} />
        <Stat label="Sessions" value={s.readingSessions.length} />
      </div>
      <Section title="Currently reading">
        {reading.length ? reading.map(b => (
          <Card key={b.id} className="space-y-3">
            <div className="flex gap-3">
              <div className="w-12 h-16 rounded-lg peach-grad grid place-items-center shrink-0"><BookOpen size={20} color="#2A1420" /></div>
              <div className="flex-1 min-w-0" onClick={() => setBookEdit(b)}>
                <div className="font-bold leading-tight">{b.title}</div>
                <div className="text-xs text-ink-3">{b.author}{b.slot !== 'any' ? ` · ${b.slot} slot` : ''}</div>
                <div className="text-xs text-ink-2 mt-1">p. {b.currentPage} / {b.totalPages} · {Math.round((b.currentPage / Math.max(1, b.totalPages)) * 100)}%</div>
              </div>
            </div>
            <Bar pct={(b.currentPage / Math.max(1, b.totalPages)) * 100} />
            <div className="flex gap-2">
              <Pill className="flex-1 h-9 text-xs" onClick={() => openFocus({ label: `Reading · ${b.title}`, category: 'Reading', minutes: 30, instanceKey: `${today}:${b.slot === 'evening' ? 'read-pm' : 'read-am'}` })}><Timer size={14} /> 30-min timer</Pill>
              <Pill variant="white" className="flex-1 h-9 text-xs" onClick={() => setLogBook(b)}>Log pages</Pill>
            </div>
          </Card>
        )) : <Empty title="No current book" />}
      </Section>
      <Section title="Recent notes & takeaways">
        {s.readingSessions.length === 0 ? <Empty title="No reading sessions yet" hint="Log pages and a takeaway after each session." /> :
          [...s.readingSessions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10).map(r => (
            <Card key={r.id} className="space-y-1">
              <div className="flex justify-between text-xs text-ink-3"><span>{s.books.find(b => b.id === r.bookId)?.title} · {prettyDate(r.date)} · {r.slot}</span><span>pp. {r.pagesFrom}–{r.pagesTo} · {fmtDur(r.minutes)}</span></div>
              {r.takeaways && <div className="text-sm font-semibold">💡 {r.takeaways}</div>}
              {r.notes && <div className="text-sm text-ink-2">{r.notes}</div>}
            </Card>
          ))}
      </Section>
      {others.length > 0 && (
        <Section title="Finished & archived">
          {others.map(b => <Card key={b.id} onClick={() => setBookEdit(b)} className="flex justify-between text-sm"><span>{b.title}</span><span className="text-ink-3">{b.status}</span></Card>)}
        </Section>
      )}
      <BookSheet book={bookEdit} onClose={() => setBookEdit(null)} />
      <LogSheet book={logBook} onClose={() => setLogBook(null)} />
    </div>
  )
}

function BookSheet({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const [f, setF] = useState<Book | null>(book)
  if (book && f?.id !== book.id) setF(book)
  if (!book || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  return (
    <Sheet open onClose={onClose} title={f.title || 'New book'}>
      <div className="space-y-3">
        <Field label="Title"><input className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Author"><input className="field" value={f.author ?? ''} onChange={e => setF({ ...f, author: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total pages"><input type="number" className="field" value={f.totalPages} onChange={e => setF({ ...f, totalPages: Number(e.target.value) })} /></Field>
          <Field label="Current page"><input type="number" className="field" value={f.currentPage} onChange={e => setF({ ...f, currentPage: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Slot"><select className="field" value={f.slot} onChange={e => setF({ ...f, slot: e.target.value as Book['slot'] })}><option value="morning">Morning (5:15)</option><option value="evening">Evening (8:00)</option><option value="any">Any</option></select></Field>
        <Field label="Status"><select className="field" value={f.status} onChange={e => setF({ ...f, status: e.target.value as Book['status'] })}><option value="reading">Reading</option><option value="finished">Finished</option><option value="archived">Archived</option></select></Field>
        <div className="flex gap-2">
          {f.status === 'reading' && <Pill onClick={() => { save('books', { ...f, status: 'archived' }); onClose() }}><Archive size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.title.trim() || f.totalPages < 1} onClick={() => { save('books', f); onClose() }}>Save book</Pill>
        </div>
      </div>
    </Sheet>
  )
}

function LogSheet({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const [to, setTo] = useState(''); const [min, setMin] = useState('30'); const [notes, setNotes] = useState(''); const [take, setTake] = useState('')
  if (!book) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const h = new Date().getHours()
  return (
    <Sheet open onClose={onClose} title={`Log · ${book.title}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Read up to page (from ${book.currentPage})`}><input type="number" className="field" value={to} onChange={e => setTo(e.target.value)} /></Field>
          <Field label="Minutes"><input type="number" className="field" value={min} onChange={e => setMin(e.target.value)} /></Field>
        </div>
        <Field label="Key takeaway"><input className="field" value={take} onChange={e => setTake(e.target.value)} /></Field>
        <Field label="Notes"><textarea rows={3} className="field" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        <Pill variant="lavender" className="w-full h-12" disabled={!(Number(to) > book.currentPage)} onClick={() => {
          const r: ReadingSession = { id: uid(), date: dateKey(), bookId: book.id, slot: h < 12 ? 'morning' : h >= 18 ? 'evening' : 'other', pagesFrom: book.currentPage, pagesTo: Math.min(Number(to), book.totalPages), minutes: Number(min) || 0, notes: notes || undefined, takeaways: take || undefined, createdAt: Date.now() }
          save('readingSessions', r)
          const page = Math.min(Number(to), book.totalPages)
          save('books', { ...book, currentPage: page, status: page >= book.totalPages ? 'finished' : book.status })
          setTo(''); setNotes(''); setTake(''); onClose()
        }}>Save</Pill>
      </div>
    </Sheet>
  )
}
