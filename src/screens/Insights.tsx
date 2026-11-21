import { Flame } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, MiniBars, ScreenHeader, Section, Segmented, Stat } from '../components/ui'
import { dailySummary, doneOn, focusMinutes, hasRecords, lastNDays, sales, statsFor, streak } from '../lib/analytics'
import { addDays, dateKey, fmtDur, parseKey, prettyDate, weekdayShort, weekOf } from '../lib/time'
import { useStore } from '../store/useStore'
import Heatmap from '../components/Heatmap'

export default function Insights() {
  const data = useStore()
  const today = dateKey()
  const [range, setRange] = useState<'week' | 'last'>('week')
  const days = range === 'week' ? weekOf(today) : weekOf(addDays(today, -7))

  const m = useMemo(() => {
    const past = days.filter(d => d <= today)
    const perDay = days.map(d => {
      const recorded = d <= today && (hasRecords(data, d) || d === today)
      const s = recorded ? statsFor(data, d).stats : null
      return { d, pct: s?.pct ?? 0, s, recorded }
    })
    const recordedDays = perDay.filter(x => x.recorded && x.s)
    const done = recordedDays.reduce((a, x) => a + x.s!.done, 0)
    const elig = recordedDays.reduce((a, x) => a + x.s!.eligible, 0)
    const missed = recordedDays.reduce((a, x) => a + x.s!.overdue + x.s!.skipped, 0)
    const focus = past.reduce((a, d) => a + focusMinutes(data, d), 0)
    const dev = past.reduce((a, d) => a + focusMinutes(data, d, c => c === 'Development'), 0)
    const studyDays = past.filter(d => doneOn(data, d, ['study']) || data.studySessions.some(s => s.date === d) || focusMinutes(data, d, c => c === 'Education') > 0).length
    const gymDays = past.filter(d => doneOn(data, d, ['gym'])).length
    const reading = data.readingSessions.filter(r => days.includes(r.date)).length + past.filter(d => doneOn(data, d, ['read-am', 'read-pm'])).length
    const biz = sales(data, days)
    return { perDay, done, elig, missed, focus, dev, studyDays, gymDays, reading, biz, weekPct: elig ? Math.round((done / elig) * 100) : 0 }
  }, [data, days, today])

  const todayS = statsFor(data, today).stats
  const streaks = useMemo(() => [
    { l: 'Study', n: streak(d => doneOn(data, d, ['study']) || data.studySessions.some(s => s.date === d)) },
    { l: 'Gym', n: streak(d => doneOn(data, d, ['gym'])) },
    { l: 'Reading', n: streak(d => doneOn(data, d, ['read-am', 'read-pm']) || data.readingSessions.some(r => r.date === d)) },
    { l: 'Manifest', n: streak(d => doneOn(data, d, ['manifest-am', 'manifest-pm', 'manifest-night']) || data.manifestations.some(x => x.date === d && x.done)) },
    { l: 'Journal', n: streak(d => !!data.journal[d] || doneOn(data, d, ['journal'])) },
    { l: 'Focus', n: streak(d => data.focusSessions.some(s => s.date === d)) },
  ], [data])
  const yesterday = dailySummary(data, addDays(today, -1))
  const anyHistory = Object.keys(data.completions).length + data.focusSessions.length > 0

  return (
    <div className="space-y-4">
      <ScreenHeader kicker="Built from your records only" title="Insights" />
      <Heatmap />
      <Segmented value={range} onChange={setRange} options={[{ v: 'week', l: 'This week' }, { v: 'last', l: 'Last week' }]} />

      <Card className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold text-ink-2">Weekly completion</div>
            <div className="text-3xl font-extrabold tracking-tight text-peach">{m.weekPct}%</div>
            <div className="text-xs text-ink-3">{m.done} of {m.elig} scheduled tasks · {m.missed} missed or skipped</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-ink-2">Today</div>
            <div className="text-xl font-extrabold">{todayS.pct}%</div>
          </div>
        </div>
        <MiniBars data={m.perDay.map(x => ({ label: weekdayShort(x.d)[0], value: x.recorded ? x.pct : 0, highlight: x.d === today }))} format={v => `${v}%`} />
        {!anyHistory && <div className="text-xs text-ink-3">No history yet — trends fill in as you complete tasks. Nothing is pre-filled.</div>}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Focus time" value={fmtDur(m.focus)} sub="all focus sessions" accent="#FFB59A" />
        <Stat label="Development" value={fmtDur(m.dev)} sub="focus on dev blocks" accent="#8FB8FF" />
        <Stat label="Study consistency" value={`${m.studyDays}/${days.filter(d => d <= today && !data.settings.weekendDays.includes(parseKey(d).getDay())).length || 5}`} sub="study days" accent="#FFCF7A" />
        <Stat label="Gym attendance" value={`${m.gymDays} days`} sub="gym blocks done" accent="#FF8FA8" />
        <Stat label="Reading sessions" value={m.reading} sub="logged + scheduled done" accent="#C9B8FF" />
        <Stat label="Outreach" value={m.biz.calls + m.biz.dms} sub={`${m.biz.calls} calls · ${m.biz.dms} DMs`} accent="#9BE7C4" />
      </div>

      <Section title="Habit streaks">
        <div className="grid grid-cols-3 gap-2">
          {streaks.map(s => (
            <div key={s.l} className="glass rounded-[18px] p-3 text-center">
              <Flame size={18} className={`mx-auto ${s.n ? 'text-peach' : 'text-ink-3'}`} />
              <div className="text-lg font-extrabold mt-1">{s.n}</div>
              <div className="text-[11px] text-ink-3 font-semibold">{s.l}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Focus minutes · last 7 days">
        <Card><MiniBars data={lastNDays(7).map(d => ({ label: weekdayShort(d)[0], value: focusMinutes(data, d), highlight: d === today }))} color="#C9B8FF" format={v => fmtDur(v)} /></Card>
      </Section>

      <Section title={`Yesterday · ${prettyDate(addDays(today, -1))}`}>
        {hasRecords(data, addDays(today, -1)) ? (
          <Card className="text-sm space-y-1.5">
            <div>Completed <b>{yesterday.stats.done}</b> of {yesterday.stats.eligible} · missed/skipped <b>{yesterday.missed.length}</b></div>
            <div>Focus <b>{fmtDur(yesterday.focusMin)}</b> · Study <b>{fmtDur(yesterday.studyMin)}</b></div>
            <div>Business: <b>{yesterday.biz.calls}</b> calls, <b>{yesterday.biz.dms}</b> DMs, <b>{yesterday.biz.meetings}</b> meetings</div>
            {yesterday.missed.length > 0 && <div className="text-xs text-ink-3">Missed: {yesterday.missed.map(i => i.title).join(', ')}</div>}
          </Card>
        ) : <Card className="text-sm text-ink-3">No activity recorded yesterday.</Card>}
      </Section>

      <Section title="Weekly review">
        <Card className="text-sm space-y-2 leading-relaxed">
          {m.elig === 0 ? <div className="text-ink-3">Complete a few tasks and your weekly review appears here.</div> : (
            <>
              <div>You completed <b>{m.weekPct}%</b> of tracked scheduled work ({m.done}/{m.elig}).</div>
              <div>Deep focus: <b>{fmtDur(m.focus)}</b>, of which development <b>{fmtDur(m.dev)}</b>.</div>
              <div>Studied on <b>{m.studyDays}</b> day(s), trained on <b>{m.gymDays}</b>.</div>
              <div>Outreach: <b>{m.biz.calls + m.biz.dms}</b> touches → <b>{m.biz.interested}</b> interested → <b>{m.biz.won}</b> won.</div>
              {m.missed > 0 && <div className="text-warning">{m.missed} activities were missed or skipped — consider moving recurring misses to a better time.</div>}
            </>
          )}
        </Card>
      </Section>
    </div>
  )
}
