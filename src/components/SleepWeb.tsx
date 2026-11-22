import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { sleepLabel, sleepScore } from '../lib/health'
import { bedTapped, clearNight, estimateLastNight, goodNight, isBedtimeWindow } from '../lib/sleepWeb'
import { addDays, dateKey, fmtDur, pad, parseKey, uid } from '../lib/time'
import type { SleepRecord } from '../lib/types'
import { useStore } from '../store/useStore'
import { Pill, spring } from './ui'

const RESTED = [['😫', 'Drained'], ['😕', 'Tired'], ['🙂', 'OK'], ['😌', 'Rested'], ['⚡', 'Energised']] as const
const hhmm = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** After 9 PM: one tap to mark bedtime (most accurate way to track sleep on the web). */
export function GoodNightCard() {
  const [tapped, setTapped] = useState(() => { const b = bedTapped(); return b && Date.now() - b < 10 * 3600e3 ? b : 0 })
  if (!isBedtimeWindow()) return null
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[22px] p-4 flex items-center gap-3"
      style={{ background: 'linear-gradient(140deg,#232a55,#151230)', border: '1px solid rgb(143 184 255 / .3)' }}>
      <div className="size-11 rounded-2xl grid place-items-center bg-[#8fb8ff]/15 shrink-0"><Moon size={20} className="text-[#8FB8FF]" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">{tapped ? `Sleep started ${fmt(tapped)}` : 'Heading to bed?'}</div>
        <div className="text-[11px] text-ink-2 leading-snug">{tapped ? 'Open Kairo when you wake up — it logs your wake-up time.' : 'Tap before you put the phone down so Kairo knows your exact bedtime.'}</div>
      </div>
      {!tapped && <Pill variant="lavender" className="h-9 text-xs shrink-0" onClick={() => { goodNight(); setTapped(Date.now()); navigator.vibrate?.(20) }}>Good night</Pill>}
    </motion.div>
  )
}

/** Morning: confirm last night (pre-filled from Good-night tap / last use and first open). */
export function MorningCheckIn() {
  const today = dateKey()
  const sleeps = useStore(s => s.sleeps)
  const goal = useStore(s => s.healthProfile.sleepGoalMin)
  const save = useStore(s => s.save)
  const h = new Date().getHours()
  const est = estimateLastNight(today)
  const [bed, setBed] = useState(est.bed ? hhmm(est.bed.at) : '')
  const [wake, setWake] = useState(hhmm(est.wake))
  const [rested, setRested] = useState<number | undefined>()
  const [done, setDone] = useState(false)
  if (h < 4 || h >= 14 || sleeps.some(r => r.date === today) && !done) return null

  const toTs = (v: string, morning: boolean) => {
    const [H, M] = v.split(':').map(Number)
    const dayKey = morning || H < 12 ? today : addDays(today, -1)
    return parseKey(dayKey).getTime() + (H * 60 + M) * 60e3
  }
  const bedTs = bed ? toTs(bed, false) : 0, wakeTs = toTs(wake, true)
  const asleep = bedTs ? Math.round((wakeTs - bedTs) / 60e3) : 0
  const valid = bedTs > 0 && asleep >= 60 && asleep <= 16 * 60
  const submit = () => {
    const r: SleepRecord = { id: uid(), date: today, sleepStart: bedTs, wake: wakeTs, asleepMin: asleep, wakeUps: 0, rested, score: 0, source: 'manual' }
    r.score = sleepScore(r, goal)
    save('sleeps', r); clearNight(); setDone(true); navigator.vibrate?.([20, 40, 20])
  }
  return (
    <AnimatePresence>
      {!done ? (
        <motion.div key="ci" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          className="rounded-[22px] p-4 space-y-3" style={{ background: 'linear-gradient(140deg,#2b3361,#191433)', border: '1px solid rgb(143 184 255 / .3)' }}>
          <div className="flex items-center gap-2"><Sun size={16} className="text-warning" /><b className="text-sm">Good morning — how did you sleep?</b></div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold text-ink-2 uppercase tracking-wide">Slept at {est.bed?.how === 'tap' ? '· Good-night tap' : est.bed ? '· last Kairo use' : ''}
              <input type="time" className="field mt-1" value={bed} onChange={e => setBed(e.target.value)} /></label>
            <label className="text-[10px] font-bold text-ink-2 uppercase tracking-wide">Woke at {est.wakeHow === 'first-open' ? '· first open' : ''}
              <input type="time" className="field mt-1" value={wake} onChange={e => setWake(e.target.value)} /></label>
          </div>
          {!bed && <div className="text-[11px] text-ink-3">Kairo didn’t see you go to bed — enter the time (tap “Good night” tonight for automatic tracking).</div>}
          {valid && <div className="text-xs text-ink-2">≈ <b className="text-ink">{fmtDur(asleep)}</b> asleep · goal {fmtDur(goal)}</div>}
          <div className="flex gap-1.5">{RESTED.map(([e, l], i) => (
            <motion.button key={l} whileTap={{ scale: 0.88 }} transition={spring} onClick={() => setRested(i + 1)}
              className={`flex-1 rounded-[14px] py-1.5 border ${rested === i + 1 ? 'bg-[#8fb8ff]/18 border-[#8fb8ff]/60' : 'border-transparent'}`}>
              <div className="text-lg">{e}</div><div className={`text-[9px] font-bold ${rested === i + 1 ? 'text-[#8FB8FF]' : 'text-ink-3'}`}>{l}</div>
            </motion.button>
          ))}</div>
          <Pill variant="lavender" className="w-full h-10" disabled={!valid} onClick={submit}>Save last night</Pill>
        </motion.div>
      ) : (
        <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[22px] p-3 text-center text-sm font-semibold text-[#8FB8FF] bg-[#8fb8ff]/10 border border-[#8fb8ff]/25">
          🌙 Sleep saved · score {sleeps.find(r => r.date === today)?.score ?? ''} {sleeps.find(r => r.date === today) ? `(${sleepLabel(sleeps.find(r => r.date === today)!.score)})` : ''}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
