import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { BarChart3, Briefcase, CalendarCheck2, FolderClosed, LayoutGrid, Timer } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { CompletionOverlay } from './components/Tasks'
import { spring } from './components/ui'
import { useDay, useNow, useReducedMotion } from './lib/hooks'
import { planNotices, syncNotifications } from './lib/notify'
import { buildDay, templateFor } from './lib/schedule'
import { dateKey, fmtClock } from './lib/time'
import { useNav, type Page, type Tab } from './store/nav'
import { useStore } from './store/useStore'
import Today from './screens/Today'

const Focus = lazy(() => import('./screens/Focus'))
const Business = lazy(() => import('./screens/Business'))
const Projects = lazy(() => import('./screens/Projects'))
const Insights = lazy(() => import('./screens/Insights'))
const More = lazy(() => import('./screens/More'))
const Timetable = lazy(() => import('./pages/Timetable'))
const Study = lazy(() => import('./pages/Study'))
const Reading = lazy(() => import('./pages/Reading'))
const Trading = lazy(() => import('./pages/Trading'))
const Habits = lazy(() => import('./pages/Habits'))
const Settings = lazy(() => import('./pages/Settings'))
const Manifest = lazy(() => import('./pages/Mind').then(m => ({ default: m.Manifestations })))
const Journal = lazy(() => import('./pages/Mind').then(m => ({ default: m.Journal })))
const ContentStudio = lazy(() => import('./pages/Content').then(m => ({ default: m.ContentStudio })))
const Research = lazy(() => import('./pages/Content').then(m => ({ default: m.ResearchLibrary })))

const TABS: { t: Tab; l: string; I: typeof Timer }[] = [
  { t: 'today', l: 'Today', I: CalendarCheck2 },
  { t: 'focus', l: 'Focus', I: Timer },
  { t: 'business', l: 'Business', I: Briefcase },
  { t: 'projects', l: 'Projects', I: FolderClosed },
  { t: 'insights', l: 'Insights', I: BarChart3 },
  { t: 'more', l: 'More', I: LayoutGrid },
]

const PAGES: Record<Page, React.ComponentType> = {
  timetable: Timetable, study: Study, reading: Reading, trading: Trading, habits: Habits, settings: Settings,
  manifest: Manifest, journal: Journal, content: ContentStudio, research: Research,
}
const SCREENS: Record<Tab, React.ComponentType> = { today: Today, focus: Focus, business: Business, projects: Projects, insights: Insights, more: More }

export default function App() {
  const hydrated = useStore(s => s.hydrated)
  const { tab, page, dir, setTab } = useNav()
  const reduced = useReducedMotion()
  const activeFocus = useStore(s => s.activeFocus)
  const immersive = tab === 'focus' && !!activeFocus && !page
  useNotificationSync()

  if (!hydrated) {
    return <div className="ambient h-full grid place-items-center"><motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-2xl font-extrabold tracking-tight">Kairo</motion.div></div>
  }

  const Screen = page ? PAGES[page] : SCREENS[tab]
  const key = page ?? tab

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className={`ambient min-h-full ${reduced ? 'reduce-motion' : ''}`}>
        <main className={`mx-auto max-w-[480px] px-4 pt-[max(12px,env(safe-area-inset-top))] ${immersive ? 'pb-[max(16px,env(safe-area-inset-bottom))]' : 'pb-32'}`}>
          {/* Entrance-only transition: exit animations + shared layoutIds can stall AnimatePresence, so pages swap instantly and fade/slide in. */}
          <motion.div key={key}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: page ? 24 * dir : 0, y: page ? 0 : 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
            <Suspense fallback={<div className="h-[60vh]" />}><Screen /></Suspense>
          </motion.div>
        </main>

        {activeFocus && tab !== 'focus' && <FocusPill />}

        <AnimatePresence>
          {!immersive && (
            <motion.nav initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={spring}
              className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[max(14px,env(safe-area-inset-bottom))] w-[calc(100%-24px)] max-w-[456px]">
              <div className="flex items-center justify-between rounded-[32px] px-1.5 h-16 bg-[#14142a]/95 border border-white/8 shadow-[0_12px_32px_rgba(0,0,0,.45)]">
                {TABS.map(({ t, l, I }) => {
                  const on = tab === t && !page || (t === 'more' && !!page)
                  return (
                    <button key={t} onClick={() => setTab(t)} className="relative flex-1 h-[52px] flex flex-col items-center justify-center gap-[3px]" aria-label={l}>
                      {on && <motion.span layoutId="nav-pill" transition={spring} className="absolute inset-x-1 inset-y-0 rounded-[22px] bg-white/8" />}
                      <I size={19} strokeWidth={2} className={`relative ${on ? 'text-peach' : 'text-ink-2'}`} />
                      <span className={`relative text-[10px] ${on ? 'font-bold text-ink' : 'font-medium text-ink-2'}`}>{l}</span>
                    </button>
                  )
                })}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        <GlobalCelebration reduced={reduced} />
      </div>
    </MotionConfig>
  )
}

function GlobalCelebration({ reduced }: { reduced: boolean }) {
  const celebration = useStore(s => s.celebration)
  const setCelebration = useStore(s => s.setCelebration)
  const now = useNow(60000)
  const { items, stats } = useDay(dateKey(now), now)
  if (celebration?.kind !== 'task') return null
  const next = items.find(i => i.status === 'active' || i.status === 'upcoming')
  return (
    <CompletionOverlay title={celebration.title} done={stats.done} eligible={stats.eligible} pct={stats.pct} next={next} reduced={reduced}
      onContinue={() => { setCelebration(null); useNav.getState().setTab('today') }} onClose={() => setCelebration(null)} />
  )
}

function FocusPill() {
  const f = useStore(s => s.activeFocus)!
  const now = useNow(1000)
  const setTab = useNav(s => s.setTab)
  const left = f.plannedMinutes * 60000 - ((f.pausedAt ?? now.getTime()) - f.startedAt - f.pausedTotalMs)
  return (
    <motion.button initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={() => setTab('focus')}
      className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] flex items-center gap-2 rounded-full pl-2 pr-4 h-10 peach-grad text-on-peach shadow-[0_8px_24px_rgba(255,140,150,.4)]">
      <span className="size-6 rounded-full bg-white/50 grid place-items-center"><Timer size={14} /></span>
      <span className="text-xs font-bold max-w-[140px] truncate">{f.label}</span>
      <span className="text-xs font-extrabold tabular-nums">{f.pausedAt ? 'Paused' : fmtClock(Math.max(0, left))}</span>
    </motion.button>
  )
}

/** Re-plan OS/web notifications whenever schedule, reminders or settings change. */
function useNotificationSync() {
  const templates = useStore(s => s.templates)
  const overrides = useStore(s => s.overrides)
  const extras = useStore(s => s.extras)
  const completions = useStore(s => s.completions)
  const reminders = useStore(s => s.reminders)
  const settings = useStore(s => s.settings)
  const hydrated = useStore(s => s.hydrated)
  const notices = useMemo(() => {
    const today = dateKey()
    return planNotices(d => buildDay({
      date: d, today, nowMinutes: 0, template: templateFor(d, templates, settings.weekendDays), overrides, extras, completions,
    }).filter(i => i.status === 'upcoming' || i.status === 'active'), reminders)
  }, [templates, overrides, extras, completions, reminders, settings.weekendDays])
  useEffect(() => {
    if (!hydrated) return
    syncNotifications(notices, settings.notifications).catch(() => {})
  }, [notices, settings.notifications, hydrated])
}
