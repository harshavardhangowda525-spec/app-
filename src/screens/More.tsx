import { motion } from 'framer-motion'
import { BellRing, BookOpen, CalendarDays, ChevronRight, Clapperboard, FlaskConical, FolderKanban, GraduationCap, LineChart, NotebookPen, Settings, Sparkles } from 'lucide-react'
import { ScreenHeader } from '../components/ui'
import { useNav, type Page } from '../store/nav'
import { useStore } from '../store/useStore'
import { dateKey } from '../lib/time'

const ITEMS: { p: Page; l: string; icon: typeof BookOpen; c: string; sub: (s: ReturnType<typeof useStore.getState>) => string }[] = [
  { p: 'timetable', l: 'Timetable', icon: CalendarDays, c: '#FFCF7A', sub: s => `${s.templates[0].blocks.length} weekday blocks · drag to move` },
  { p: 'projects', l: 'Projects', icon: FolderKanban, c: '#8FB8FF', sub: s => `${s.projects.filter(p => p.status !== 'Delivered').length} active client projects` },
  { p: 'content', l: 'Content Studio', icon: Clapperboard, c: '#FF9ECF', sub: s => `${s.content.filter(c => c.status !== 'Published').length} in progress` },
  { p: 'trading', l: 'Trading Journal', icon: LineChart, c: '#9BE7C4', sub: s => `${s.trades.length} entries · ${s.trackedInstruments.join(', ')}` },
  { p: 'research', l: 'Research Library', icon: FlaskConical, c: '#B7E07A', sub: s => `${s.research.length} saved` },
  { p: 'study', l: 'Study Tracker', icon: GraduationCap, c: '#FFB59A', sub: s => `${s.subjects.filter(x => !x.archived).length} NIOS subjects` },
  { p: 'reading', l: 'Reading Tracker', icon: BookOpen, c: '#FFCF7A', sub: s => s.books.find(b => b.status === 'reading')?.title ?? 'No current book' },
  { p: 'manifest', l: 'Manifestations', icon: Sparkles, c: '#C9B8FF', sub: s => `${s.manifestations.filter(m => m.date === dateKey() && m.done).length}/3 today` },
  { p: 'journal', l: 'Daily Journal', icon: NotebookPen, c: '#C9B8FF', sub: s => (s.journal[dateKey()] ? 'Written today' : 'Not written today') },
  { p: 'habits', l: 'Recurring Habits', icon: BellRing, c: '#8FB8FF', sub: s => `${s.reminders.filter(r => r.active).length} active reminders` },
  { p: 'settings', l: 'Account, Settings & Backup', icon: Settings, c: '#9A98AE', sub: () => 'Sign in & sync, AI key, notifications, backup' },
]

export default function More() {
  const open = useNav(s => s.open)
  const s = useStore()
  return (
    <div className="space-y-4">
      <ScreenHeader kicker="Kairo" title="More" />
      <div className="space-y-2">
        {ITEMS.map((it, i) => (
          <motion.button key={it.p} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
            whileTap={{ scale: 0.98 }} onClick={() => open(it.p)} className="w-full glass rounded-[18px] px-3.5 py-3 flex items-center gap-3 text-left">
            <div className="size-9 rounded-xl grid place-items-center" style={{ background: `${it.c}1f` }}><it.icon size={18} color={it.c} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{it.l}</div>
              <div className="text-xs text-ink-3 truncate">{it.sub(s)}</div>
            </div>
            <ChevronRight size={16} className="text-ink-3" />
          </motion.button>
        ))}
      </div>
    </div>
  )
}
