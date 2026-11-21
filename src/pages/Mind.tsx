import { AnimatePresence, motion } from 'framer-motion'
import { Check, Moon, Search, Sun, Sunset } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, Field, Pill, ScreenHeader, Section } from '../components/ui'
import { JOURNAL_QUESTIONS } from '../data/defaults'
import { addDays, dateKey, prettyDateLong, uid } from '../lib/time'
import type { ManifestationEntry, ManifestSlot } from '../lib/types'
import { useStore } from '../store/useStore'

const SLOTS: { s: ManifestSlot; l: string; t: string; icon: typeof Sun; blockId: string }[] = [
  { s: 'morning', l: 'Morning', t: '6:00 AM', icon: Sun, blockId: 'manifest-am' },
  { s: 'evening', l: 'Evening', t: '6:00 PM', icon: Sunset, blockId: 'manifest-pm' },
  { s: 'night', l: 'Night', t: '9:15 PM', icon: Moon, blockId: 'manifest-night' },
]

export function Manifestations() {
  const entries = useStore(s => s.manifestations)
  const save = useStore(s => s.save)
  const today = dateKey()
  const h = new Date().getHours()
  const [slot, setSlot] = useState<ManifestSlot>(h < 12 ? 'morning' : h < 20 ? 'evening' : 'night')
  const existing = entries.find(e => e.date === today && e.slot === slot)
  const last = [...entries].filter(e => e.slot === slot).sort((a, b) => b.at - a.at)[0]
  const [draft, setDraft] = useState<Record<string, ManifestationEntry>>({})
  const cur: ManifestationEntry = draft[slot] ?? existing ?? {
    id: uid(), date: today, slot, affirmations: last?.affirmations ?? '', goals: last?.goals ?? '', journal: '', done: false, at: Date.now(),
  }
  const upd = (p: Partial<ManifestationEntry>) => setDraft(d => ({ ...d, [slot]: { ...cur, ...p } }))
  const history = [...entries].sort((a, b) => b.at - a.at).slice(0, 12)

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="Three calm moments a day" title="Manifestations" />
      <div className="grid grid-cols-3 gap-2">
        {SLOTS.map(x => {
          const done = entries.some(e => e.date === today && e.slot === x.s && e.done)
          return (
            <motion.button key={x.s} whileTap={{ scale: 0.96 }} onClick={() => setSlot(x.s)}
              className={`relative rounded-[20px] p-3 text-left ${slot === x.s ? 'glass-strong !border-lavender/40' : 'glass'}`}>
              <x.icon size={18} className={done ? 'text-lavender' : 'text-ink-2'} />
              <div className="text-sm font-bold mt-1.5">{x.l}</div>
              <div className="text-[11px] text-ink-3">{x.t}</div>
              {done && <span className="absolute top-2.5 right-2.5 size-5 rounded-full bg-lavender grid place-items-center"><Check size={12} strokeWidth={3} color="#1B1430" /></span>}
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={slot} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: 'easeOut' }}
          className="rounded-[24px] p-4 space-y-3" style={{ background: 'linear-gradient(170deg,#221a3d,#13111f)', border: '1px solid rgb(201 184 255 / .2)' }}>
          <Field label="Affirmations"><textarea rows={4} className="field" placeholder="I am disciplined. I build every day…" value={cur.affirmations} onChange={e => upd({ affirmations: e.target.value })} /></Field>
          <Field label="Goals I'm calling in"><textarea rows={3} className="field" value={cur.goals} onChange={e => upd({ goals: e.target.value })} /></Field>
          <Field label="Private reflection"><textarea rows={3} className="field" value={cur.journal} onChange={e => upd({ journal: e.target.value })} /></Field>
          <div className="flex gap-2">
            <Pill className="flex-1" onClick={() => save('manifestations', { ...cur, at: Date.now() })}>Save</Pill>
            <Pill variant="lavender" className="flex-1" onClick={() => {
              const st = useStore.getState()
              st.save('manifestations', { ...cur, done: true, at: Date.now() })
              const blk = SLOTS.find(x => x.s === slot)!.blockId
              if (!st.completions[`${today}:${blk}`]) {
                const tpl = st.templates.find(t => t.blocks.some(b => b.id === blk))?.blocks.find(b => b.id === blk)
                if (tpl) st.complete({ ...tpl, key: `${today}:${blk}`, date: today, startMin: 0, endMin: 0, status: 'active', rescheduled: false, extra: false })
              }
            }}><Check size={16} /> Complete</Pill>
          </div>
        </motion.div>
      </AnimatePresence>
      <Section title="History">
        {history.length === 0 ? <Card className="text-sm text-ink-3">Your sessions will appear here.</Card> : history.map(e => (
          <Card key={e.id} className="space-y-1">
            <div className="flex justify-between text-xs text-ink-3"><span>{prettyDateLong(e.date)} · {e.slot}</span>{e.done && <span className="text-lavender font-bold">✓ done</span>}</div>
            <div className="text-sm text-ink-2 line-clamp-2 whitespace-pre-line">{e.affirmations || e.journal}</div>
          </Card>
        ))}
      </Section>
    </div>
  )
}

export function Journal() {
  const journal = useStore(s => s.journal)
  const saveJournal = useStore(s => s.saveJournal)
  const [date, setDate] = useState(dateKey())
  const [q, setQ] = useState('')
  const [answers, setAnswers] = useState<string[]>(() => journal[date]?.answers ?? JOURNAL_QUESTIONS.map(() => ''))
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const load = (d: string) => { setDate(d); setAnswers(journal[d]?.answers ?? JOURNAL_QUESTIONS.map(() => '')); setSavedAt(null) }
  const results = useMemo(() => {
    const all = Object.values(journal).sort((a, b) => b.date.localeCompare(a.date))
    return q ? all.filter(e => e.answers.join(' ').toLowerCase().includes(q.toLowerCase())) : all.slice(0, 10)
  }, [journal, q])

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="8:30 – 9:00 PM · private, on-device" title="Daily Journal" />
      <Field label="Entry date"><input type="date" className="field" value={date} onChange={e => e.target.value && load(e.target.value)} /></Field>
      <div className="space-y-3">
        {JOURNAL_QUESTIONS.map((qq, i) => (
          <Field key={i} label={`${i + 1}. ${qq}`}>
            <textarea rows={i === 6 ? 3 : 2} className="field" value={answers[i] ?? ''} placeholder={i === 6 ? 'One per line — these feed tomorrow’s summary' : ''}
              onChange={e => setAnswers(a => a.map((x, j) => (j === i ? e.target.value : x)))} />
          </Field>
        ))}
        <Pill variant="lavender" className="w-full h-12" onClick={() => {
          saveJournal(date, answers); setSavedAt(Date.now())
          const pr = (answers[6] ?? '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3)
          const nk = addDays(date, 1)
          const st = useStore.getState()
          if (pr.length && !(st.priorities[nk] ?? []).some(Boolean)) st.setPriorities(nk, [...pr, '', ''].slice(0, 3))
        }}>{savedAt ? 'Saved ✓' : 'Save entry'}</Pill>
      </div>
      <Section title="Search history">
        <div className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="field !pl-10" placeholder="Search all entries" value={q} onChange={e => setQ(e.target.value)} /></div>
        {results.map(e => (
          <Card key={e.date} onClick={() => load(e.date)} className="space-y-1">
            <div className="text-xs text-ink-3">{prettyDateLong(e.date)}</div>
            <div className="text-sm line-clamp-2">{e.answers.find(Boolean) ?? '—'}</div>
          </Card>
        ))}
        {results.length === 0 && <Card className="text-sm text-ink-3">{q ? 'No matches.' : 'No entries yet.'}</Card>}
      </Section>
    </div>
  )
}
