import { motion } from 'framer-motion'
import { Phone, Plus, Search, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, Counter, Empty, Field, MiniBars, Pill, ScreenHeader, Section, Segmented, Sheet, Stat, confirmDelete } from '../components/ui'
import { sales as sumSales, lastNDays } from '../lib/analytics'
import { dateKey, prettyDate, uid, weekdayShort, weekOf } from '../lib/time'
import { LEAD_STAGES, type BusinessLead, type LeadStage } from '../lib/types'
import { useStore } from '../store/useStore'

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const STAGE_COLOR: Record<LeadStage, string> = {
  New: '#9A98AE', Contacted: '#8FB8FF', Interested: '#FFCF7A', Demo: '#C9B8FF', Proposal: '#FFB59A', Won: '#9BE7C4', Lost: '#FF8A8A',
}

export default function Business() {
  const today = dateKey()
  const sales = useStore(s => s.sales)
  const leads = useStore(s => s.leads)
  const projects = useStore(s => s.projects)
  const bump = useStore(s => s.bumpSales)
  const [tab, setTab] = useState<'today' | 'pipeline' | 'performance'>('today')
  const [edit, setEdit] = useState<BusinessLead | null>(null)
  const [stage, setStage] = useState<LeadStage | 'All'>('All')
  const [q, setQ] = useState('')

  const t = sales[today] ?? { date: today, calls: 0, dms: 0, interested: 0, meetings: 0, proposals: 0, won: 0 }
  const due = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= today && l.stage !== 'Won' && l.stage !== 'Lost')
  const week = weekOf(today)
  const wk = sumSales({ sales } as never, week)
  const active = leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost')
  const pipelineValue = active.reduce((a, l) => a + (l.quotedAmount ?? 0), 0)
  const wonRevenue = leads.filter(l => l.stage === 'Won').reduce((a, l) => a + (l.quotedAmount ?? 0), 0)
  const outstanding = projects.reduce((a, p) => a + Math.max(0, (p.value ?? 0) - (p.paid ?? 0)), 0)
  const outreach = wk.calls + wk.dms
  const conv = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

  const filtered = useMemo(() => leads
    .filter(l => stage === 'All' || l.stage === stage)
    .filter(l => !q || `${l.businessName} ${l.contactName ?? ''} ${l.industry ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.nextFollowUp ?? '9') .localeCompare(b.nextFollowUp ?? '9')), [leads, stage, q])

  const newLead = (): BusinessLead => ({ id: uid(), businessName: '', stage: 'New', createdAt: Date.now(), updatedAt: Date.now() })

  return (
    <div className="space-y-4">
      <ScreenHeader kicker="Infinity Web & Apps" title="Business" right={<Pill variant="lavender" className="h-9" onClick={() => setEdit(newLead())}><Plus size={16} /> Lead</Pill>} />
      <Segmented value={tab} onChange={setTab} options={[{ v: 'today', l: 'Today' }, { v: 'pipeline', l: `Pipeline · ${active.length}` }, { v: 'performance', l: 'Performance' }]} />

      {tab === 'today' && (
        <>
          <Section title={`Sales activity · ${prettyDate(today)}`}>
            <div className="grid grid-cols-2 gap-2">
              {([['calls', 'Cold calls'], ['dms', 'Instagram DMs'], ['interested', 'Interested'], ['meetings', 'Meetings set'], ['proposals', 'Proposals sent'], ['won', 'Clients won']] as const).map(([k, l]) => (
                <Counter key={k} label={l} value={t[k]} onInc={() => bump(today, k, 1)} onDec={() => bump(today, k, -1)} />
              ))}
            </div>
          </Section>
          <Section title={`Follow-ups due · ${due.length}`}>
            {due.length ? <div className="space-y-2">{due.map(l => <LeadRow key={l.id} l={l} onClick={() => setEdit(l)} />)}</div>
              : <Empty icon={<Phone size={18} className="text-success" />} title="No follow-ups due" hint="Set a next follow-up date on a lead and it will show up here on the day." />}
          </Section>
        </>
      )}

      {tab === 'pipeline' && (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
            {(['All', ...LEAD_STAGES] as const).map(s => {
              const n = s === 'All' ? leads.length : leads.filter(l => l.stage === s).length
              return (
                <button key={s} onClick={() => setStage(s)} className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold ${stage === s ? 'bg-white text-on-peach' : 'glass text-ink-2'}`}>
                  {s} <span className="opacity-60">{n}</span>
                </button>
              )
            })}
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="field !pl-10" placeholder="Search leads" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {filtered.length ? <div className="space-y-2">{filtered.map(l => <LeadRow key={l.id} l={l} onClick={() => setEdit(l)} />)}</div>
            : <Empty icon={<Users size={18} className="text-lavender" />} title={leads.length ? 'No leads match' : 'No leads yet'} hint="Add real prospects as you call and DM — Kairo never invents numbers." action={<Pill onClick={() => setEdit(newLead())}><Plus size={16} /> Add lead</Pill>} />}
        </>
      )}

      {tab === 'performance' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Outreach this week" value={outreach} sub={`${wk.calls} calls · ${wk.dms} DMs`} />
            <Stat label="Interested rate" value={conv(wk.interested, outreach)} sub={`${wk.interested} interested`} accent="#FFCF7A" />
            <Stat label="Meeting → proposal" value={conv(wk.proposals, wk.meetings)} sub={`${wk.meetings} meetings`} />
            <Stat label="Proposal → won" value={conv(wk.won, wk.proposals)} sub={`${wk.won} won`} accent="#9BE7C4" />
            <Stat label="Pipeline value" value={inr(pipelineValue)} sub={`${active.length} open leads`} accent="#FFB59A" />
            <Stat label="Won revenue" value={inr(wonRevenue)} sub="from won leads" accent="#9BE7C4" />
            <Stat label="Outstanding payments" value={inr(outstanding)} sub="from client projects" accent="#FF8A8A" />
            <Stat label="Clients won (week)" value={wk.won} />
          </div>
          <Section title="Daily outreach · last 7 days">
            <Card>
              <MiniBars data={lastNDays(7).map(d => ({ label: weekdayShort(d)[0], value: (sales[d]?.calls ?? 0) + (sales[d]?.dms ?? 0), highlight: d === today }))} />
            </Card>
          </Section>
          <Section title="Pipeline by stage">
            <Card className="space-y-2">
              {LEAD_STAGES.map(s => {
                const n = leads.filter(l => l.stage === s).length
                return (
                  <div key={s} className="flex items-center gap-3 text-sm">
                    <span className="w-20 text-ink-2 font-semibold">{s}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/6 overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: STAGE_COLOR[s] }} initial={{ width: 0 }} animate={{ width: `${leads.length ? (n / leads.length) * 100 : 0}%` }} />
                    </div>
                    <span className="w-6 text-right font-bold">{n}</span>
                  </div>
                )
              })}
            </Card>
          </Section>
        </>
      )}

      <LeadSheet lead={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function LeadRow({ l, onClick }: { l: BusinessLead; onClick: () => void }) {
  const today = dateKey()
  const overdue = l.nextFollowUp && l.nextFollowUp <= today && l.stage !== 'Won' && l.stage !== 'Lost'
  return (
    <motion.button layout whileTap={{ scale: 0.98 }} onClick={onClick} className="w-full text-left glass rounded-[18px] px-3.5 py-3 flex items-center gap-3">
      <div className="size-9 rounded-xl grid place-items-center text-sm font-extrabold shrink-0" style={{ background: `${STAGE_COLOR[l.stage]}22`, color: STAGE_COLOR[l.stage] }}>
        {l.businessName.slice(0, 1).toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{l.businessName || 'Untitled lead'}</div>
        <div className={`text-xs truncate ${overdue ? 'text-warning' : 'text-ink-3'}`}>
          {l.stage}{l.industry ? ` · ${l.industry}` : ''}{l.nextFollowUp ? ` · follow up ${l.nextFollowUp === today ? 'today' : prettyDate(l.nextFollowUp)}` : ''}
        </div>
      </div>
      {l.quotedAmount ? <div className="text-sm font-bold text-peach">{inr(l.quotedAmount)}</div> : null}
    </motion.button>
  )
}

function LeadSheet({ lead, onClose }: { lead: BusinessLead | null; onClose: () => void }) {
  const save = useStore(s => s.save)
  const remove = useStore(s => s.remove)
  const exists = useStore(s => !!lead && s.leads.some(l => l.id === lead.id))
  const [f, setF] = useState<BusinessLead | null>(lead)
  if (lead && f?.id !== lead.id) setF(lead)
  if (!lead || !f) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const set = <K extends keyof BusinessLead>(k: K, v: BusinessLead[K]) => setF({ ...f, [k]: v })
  const txt = (k: keyof BusinessLead, label: string, type = 'text', placeholder = '') => (
    <Field label={label}>
      <input type={type} className="field" placeholder={placeholder} value={(f[k] as string | number | undefined) ?? ''}
        onChange={e => set(k, (type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value) as never)} />
    </Field>
  )
  return (
    <Sheet open onClose={onClose} title={exists ? 'Edit lead' : 'New lead'}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (!f.businessName.trim()) return; save('leads', { ...f, updatedAt: Date.now() }); onClose() }}>
        {txt('businessName', 'Business name *', 'text', 'e.g. Sharma Dental Clinic')}
        <div className="grid grid-cols-2 gap-3">{txt('contactName', 'Contact person')}{txt('phone', 'Phone', 'tel')}</div>
        <div className="grid grid-cols-2 gap-3">{txt('email', 'Email', 'email')}{txt('instagram', 'Instagram', 'text', '@handle')}</div>
        <div className="grid grid-cols-2 gap-3">{txt('industry', 'Industry')}{txt('source', 'Lead source', 'text', 'Cold call / IG / referral')}</div>
        <Field label="Pipeline stage">
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STAGES.map(s => (
              <button type="button" key={s} onClick={() => set('stage', s)} className={`h-8 px-3 rounded-full text-xs font-bold ${f.stage === s ? 'text-on-peach' : 'glass text-ink-2'}`}
                style={f.stage === s ? { background: STAGE_COLOR[s] } : undefined}>{s}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">{txt('lastContact', 'Last contact', 'date')}{txt('nextFollowUp', 'Next follow-up', 'date')}</div>
        {txt('quotedAmount', 'Quoted amount (₹)', 'number')}
        <Field label="Notes"><textarea rows={3} className="field" value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field>
        <div className="flex gap-2 pt-1">
          {exists && <Pill variant="danger" onClick={() => { if (confirmDelete(f.businessName)) { remove('leads', f.id); onClose() } }}><Trash2 size={16} /></Pill>}
          {f.phone && <a href={`tel:${f.phone}`} className="glass h-10 px-4 rounded-full inline-flex items-center gap-2 text-sm font-bold"><Phone size={16} /> Call</a>}
          <Pill type="submit" variant="lavender" className="flex-1" disabled={!f.businessName.trim()}>Save lead</Pill>
        </div>
      </form>
    </Sheet>
  )
}
