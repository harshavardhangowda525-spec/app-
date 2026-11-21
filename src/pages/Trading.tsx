import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, Field, Pill, ScreenHeader, Segmented, Sheet, Stat, confirmDelete } from '../components/ui'
import { dateKey, prettyDate, uid } from '../lib/time'
import type { TradeJournalEntry } from '../lib/types'
import { useStore } from '../store/useStore'

export function riskReward(t: Pick<TradeJournalEntry, 'entry' | 'stopLoss' | 'target'>) {
  if (t.entry == null || t.stopLoss == null || t.target == null) return null
  const risk = Math.abs(t.entry - t.stopLoss)
  if (!risk) return null
  return Math.abs(t.target - t.entry) / risk
}

/** Downscale screenshots before storing (keeps IndexedDB light on low-memory phones). */
async function compress(file: File, max = 1000): Promise<string> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg', 0.72)
}

export default function Trading() {
  const trades = useStore(s => s.trades)
  const instruments = useStore(s => s.trackedInstruments)
  const [kind, setKind] = useState<'paper' | 'real'>('paper')
  const [edit, setEdit] = useState<TradeJournalEntry | null>(null)
  const list = trades.filter(t => t.kind === kind).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const closed = list.filter(t => t.outcome !== 'Open')
  const wins = closed.filter(t => t.outcome === 'Win').length
  const rrs = list.map(riskReward).filter((x): x is number => x !== null)

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="Practice 7:15 AM · Journal 7:30 PM" title="Trading Journal"
        right={<Pill variant="lavender" className="h-9" onClick={() => setEdit({ id: uid(), date: dateKey(), kind, instrument: instruments[0] ?? 'NIFTYBEES', direction: 'Long', outcome: 'Open', screenshots: [], createdAt: Date.now() })}><Plus size={16} /> Entry</Pill>} />
      <Segmented value={kind} onChange={setKind} options={[{ v: 'paper', l: 'Paper trades' }, { v: 'real', l: 'Real trades' }]} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Entries" value={list.length} />
        <Stat label="Win rate" value={closed.length ? `${Math.round((wins / closed.length) * 100)}%` : '—'} accent="#9BE7C4" />
        <Stat label="Avg R:R" value={rrs.length ? `1:${(rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(1)}` : '—'} accent="#FFB59A" />
      </div>
      <p className="text-xs text-ink-3">A journal only — Kairo never places trades. {kind === 'real' ? 'Real trades are kept separate from paper practice.' : ''}</p>
      {list.length === 0 ? <Empty title={`No ${kind} trades yet`} hint="Log setup, entry, stop, target and what you learned." /> : list.map(t => {
        const rr = riskReward(t)
        return (
          <Card key={t.id} onClick={() => setEdit(t)} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <div className="font-bold">{t.instrument} <span className={`text-xs ${t.direction === 'Long' ? 'text-success' : 'text-danger'}`}>{t.direction}</span></div>
              <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${t.outcome === 'Win' ? 'bg-success/15 text-success' : t.outcome === 'Loss' ? 'bg-danger/15 text-danger' : 'bg-white/8 text-ink-2'}`}>{t.outcome}</span>
            </div>
            <div className="text-xs text-ink-3">{prettyDate(t.date)}{t.setup ? ` · ${t.setup}` : ''}</div>
            <div className="text-xs text-ink-2">E {t.entry ?? '—'} · SL {t.stopLoss ?? '—'} · T {t.target ?? '—'}{rr ? ` · R:R 1:${rr.toFixed(2)}` : ''}</div>
            {t.lessons && <div className="text-sm text-ink-2 line-clamp-2">📘 {t.lessons}</div>}
          </Card>
        )
      })}
      <TradeSheet t={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function TradeSheet({ t, onClose }: { t: TradeJournalEntry | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const instruments = useStore(s => s.trackedInstruments)
  const exists = useStore(s => !!t && s.trades.some(x => x.id === t.id))
  const [f, setF] = useState<TradeJournalEntry | null>(t)
  if (t && f?.id !== t.id) setF(t)
  if (!t || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const num = (k: 'entry' | 'stopLoss' | 'target' | 'exit' | 'quantity', l: string) => (
    <Field label={l}><input type="number" step="any" inputMode="decimal" className="field" value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
  )
  const rr = riskReward(f)
  return (
    <Sheet open onClose={onClose} title={`${f.kind === 'paper' ? 'Paper' : 'Real'} trade`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Instrument"><input list="instr" className="field" value={f.instrument} onChange={e => setF({ ...f, instrument: e.target.value.toUpperCase() })} /><datalist id="instr">{instruments.map(i => <option key={i} value={i} />)}</datalist></Field>
          <Field label="Date"><input type="date" className="field" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Segmented value={f.direction} onChange={v => setF({ ...f, direction: v })} options={[{ v: 'Long', l: 'Long' }, { v: 'Short', l: 'Short' }]} />
        <Field label="Setup"><input className="field" placeholder="e.g. Pullback to 20 EMA" value={f.setup ?? ''} onChange={e => setF({ ...f, setup: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-2">{num('entry', 'Entry')}{num('stopLoss', 'Stop loss')}{num('target', 'Target')}</div>
        <div className="grid grid-cols-2 gap-2">{num('exit', 'Exit')}{num('quantity', 'Qty')}</div>
        <div className="text-sm">Risk/reward: <b className="text-peach">{rr ? `1 : ${rr.toFixed(2)}` : '—'}</b></div>
        <Field label="Outcome">
          <div className="flex gap-1.5">{(['Open', 'Win', 'Loss', 'Breakeven'] as const).map(o => <button key={o} onClick={() => setF({ ...f, outcome: o })} className={`flex-1 h-8 rounded-full text-xs font-bold ${f.outcome === o ? 'bg-white text-on-peach' : 'glass text-ink-2'}`}>{o}</button>)}</div>
        </Field>
        <Field label="Screenshots">
          <div className="flex gap-2 flex-wrap">
            {f.screenshots.map((s, i) => (
              <div key={i} className="relative">
                <img src={s} alt="" className="size-20 rounded-xl object-cover" />
                <button onClick={() => setF({ ...f, screenshots: f.screenshots.filter((_, j) => j !== i) })} className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-black/80 grid place-items-center" aria-label="Remove"><X size={12} /></button>
              </div>
            ))}
            <label className="size-20 rounded-xl glass grid place-items-center cursor-pointer">
              <ImagePlus size={20} className="text-ink-2" />
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return
                const d = await compress(file); setF(cur => cur && { ...cur, screenshots: [...cur.screenshots, d] }); e.target.value = ''
              }} />
            </label>
          </div>
        </Field>
        <Field label="Notes"><textarea rows={2} className="field" value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        <Field label="Mistakes"><textarea rows={2} className="field" value={f.mistakes ?? ''} onChange={e => setF({ ...f, mistakes: e.target.value })} /></Field>
        <Field label="Lessons learned"><textarea rows={2} className="field" value={f.lessons ?? ''} onChange={e => setF({ ...f, lessons: e.target.value })} /></Field>
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete('this trade entry')) { remove('trades', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!f.instrument.trim()} onClick={() => { save('trades', f); onClose() }}>Save entry</Pill>
        </div>
      </div>
    </Sheet>
  )
}
