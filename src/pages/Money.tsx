import { motion } from 'framer-motion'
import { PiggyBank, Plus, Trash2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, Card, Empty, Field, Pill, ScreenHeader, Section, Sheet, Stat, confirmDelete } from '../components/ui'
import { dateKey, prettyDate, uid } from '../lib/time'
import type { Expense } from '../lib/types'
import { useStore } from '../store/useStore'

const CATS = ['Food', 'Travel', 'Gym & health', 'Education', 'Business', 'Subscriptions', 'Shopping', 'Family', 'Other']
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function Money() {
  const expenses = useStore(s => s.expenses)
  const t2 = useStore(s => s.targets2)
  const updateTargets2 = useStore(s => s.updateTargets2)
  const [month, setMonth] = useState(dateKey().slice(0, 7))
  const [edit, setEdit] = useState<Expense | null>(null)
  const inMonth = useMemo(() => expenses.filter(e => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [expenses, month])
  const spent = inMonth.reduce((a, e) => a + e.amount, 0)
  const byCat = CATS.map(c => ({ c, v: inMonth.filter(e => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)
  const shift = (d: number) => { const [y, m] = month.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`) }
  const saved = t2.savingsGoal ? Math.max(0, (t2.monthlyBudget ?? 0) - spent) : 0
  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="The Psychology of Money, applied" title="Money" right={<Pill variant="lavender" className="h-9" onClick={() => setEdit({ id: uid(), date: dateKey(), amount: 0, category: 'Food', createdAt: Date.now() })}><Plus size={16} /> Spend</Pill>} />
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="glass h-8 px-3 rounded-full text-xs font-bold">‹</button>
        <b className="text-sm">{new Date(`${month}-01T00:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' })}</b>
        <button onClick={() => shift(1)} className="glass h-8 px-3 rounded-full text-xs font-bold">›</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Spent" value={inr(spent)} sub={`${inMonth.length} entries`} accent="#FFB59A" />
        <Stat label="Monthly budget" value={t2.monthlyBudget ? inr(t2.monthlyBudget) : '—'} sub={t2.monthlyBudget ? `${inr(Math.max(0, t2.monthlyBudget - spent))} left` : 'tap below to set'} accent="#9BE7C4" />
      </div>
      {t2.monthlyBudget ? <Bar pct={(spent / t2.monthlyBudget) * 100} grad={spent > t2.monthlyBudget ? 'bg-danger' : 'peach-grad'} /> : null}
      <Card className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold"><PiggyBank size={16} className="text-success" /> Savings goal</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Monthly budget ₹"><input type="number" className="field" value={t2.monthlyBudget ?? ''} onChange={e => updateTargets2({ monthlyBudget: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Save per month ₹"><input type="number" className="field" value={t2.savingsGoal ?? ''} onChange={e => updateTargets2({ savingsGoal: e.target.value ? Number(e.target.value) : undefined })} /></Field>
        </div>
        {t2.savingsGoal && t2.monthlyBudget ? <div className="text-xs text-ink-2">Under budget by <b className={saved >= t2.savingsGoal ? 'text-success' : 'text-warning'}>{inr(saved)}</b> — goal {inr(t2.savingsGoal)}. “Saving is the gap between your ego and your income.”</div> : null}
      </Card>
      {byCat.length > 0 && (
        <Section title="Where it went">
          <Card className="space-y-2">
            {byCat.map(({ c, v }, i) => (
              <div key={c} className="flex items-center gap-2 text-xs">
                <span className="w-24 text-ink-2 font-semibold truncate">{c}</span>
                <div className="flex-1 h-2 rounded-full bg-white/6 overflow-hidden"><motion.div className="h-full rounded-full peach-grad" initial={{ width: 0 }} animate={{ width: `${(v / byCat[0].v) * 100}%` }} transition={{ delay: i * 0.05 }} /></div>
                <span className="w-16 text-right font-bold">{inr(v)}</span>
              </div>
            ))}
          </Card>
        </Section>
      )}
      <Section title="Entries">
        {inMonth.length === 0 ? <Empty icon={<Wallet size={18} className="text-peach" />} title="No spending logged this month" /> : inMonth.map(e => (
          <Card key={e.id} onClick={() => setEdit(e)} className="flex items-center gap-3 !p-3">
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{e.note || e.category}</div><div className="text-[11px] text-ink-3">{e.category} · {prettyDate(e.date)}</div></div>
            <b className="text-sm">{inr(e.amount)}</b>
          </Card>
        ))}
      </Section>
      <ExpenseSheet e={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function ExpenseSheet({ e, onClose }: { e: Expense | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!e && s.expenses.some(x => x.id === e.id))
  const [f, setF] = useState<Expense | null>(e)
  if (e && f?.id !== e.id) setF(e)
  if (!e || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  return (
    <Sheet open onClose={onClose} title={exists ? 'Edit spend' : 'Add spend'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount ₹"><input autoFocus type="number" inputMode="decimal" className="field" value={f.amount || ''} onChange={x => setF({ ...f, amount: Number(x.target.value) || 0 })} /></Field>
          <Field label="Date"><input type="date" className="field" value={f.date} onChange={x => setF({ ...f, date: x.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-1.5">{CATS.map(c => <button key={c} onClick={() => setF({ ...f, category: c })} className={`h-8 px-3 rounded-full text-xs font-bold ${f.category === c ? 'bg-white text-on-peach' : 'glass text-ink-2'}`}>{c}</button>)}</div>
        <Field label="Note"><input className="field" value={f.note ?? ''} onChange={x => setF({ ...f, note: x.target.value })} /></Field>
        <div className="flex gap-2">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete('this entry')) { remove('expenses', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          <Pill variant="lavender" className="flex-1" disabled={!(f.amount > 0)} onClick={() => { save('expenses', f); onClose() }}>Save</Pill>
        </div>
      </div>
    </Sheet>
  )
}
