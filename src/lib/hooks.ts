import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { buildDay, dayStats, templateFor } from './schedule'
import { dateKey, nowMin } from './time'

/** Re-render on an interval using the device clock. */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    const vis = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [intervalMs])
  return now
}

export function useDay(date: string, now: Date) {
  const templates = useStore(s => s.templates)
  const overrides = useStore(s => s.overrides)
  const extras = useStore(s => s.extras)
  const completions = useStore(s => s.completions)
  const settings = useStore(s => s.settings)
  const today = dateKey(now)
  const minuteBucket = Math.floor(nowMin(now))
  return useMemo(() => {
    const template = templateFor(date, templates, settings.weekendDays)
    const items = buildDay({ date, today, nowMinutes: nowMin(now), template, overrides, extras, completions, graceMin: settings.overdueGraceMin })
    return { items, stats: dayStats(items), template }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, today, minuteBucket, templates, overrides, extras, completions, settings.weekendDays, settings.overdueGraceMin])
}

export function useReducedMotion() {
  const pref = useStore(s => s.settings.reducedMotion)
  const [sys, setSys] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const h = () => setSys(m.matches)
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  return pref === 'on' ? true : pref === 'off' ? false : sys
}
