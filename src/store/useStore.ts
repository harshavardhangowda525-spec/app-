import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type {
  ActiveFocus, ActivityCompletion, ActivityInstance, Book, BusinessLead, ClientProject, ContentItem,
  DailyJournalEntry, DayOverride, ExtraActivity, FocusSession, ManifestationEntry, PracticeAnswer,
  ReadingSession, Reminder, ResearchItem, SalesDay, ScheduleBlock, ScheduleTemplate, StudySession,
  StudySubject, TradeJournalEntry, UserSettings,
} from '../lib/types'
import { defaultBooks, defaultReminders, defaultSettings, defaultSubjects, defaultTemplates } from '../data/defaults'
import { dateKey, uid } from '../lib/time'
import { afterAction, firstDue, nextOccurrence } from '../lib/recurrence'

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: async (name, value) => { await idbSet(name, value) },
  removeItem: async (name) => { await idbDel(name) },
}

export interface Data {
  settings: UserSettings
  templates: ScheduleTemplate[]
  overrides: DayOverride[]
  extras: ExtraActivity[]
  completions: Record<string, ActivityCompletion>
  focusSessions: FocusSession[]
  activeFocus: ActiveFocus | null
  reminders: Reminder[]
  leads: BusinessLead[]
  sales: Record<string, SalesDay>
  projects: ClientProject[]
  subjects: StudySubject[]
  studySessions: StudySession[]
  practice: PracticeAnswer[]
  trades: TradeJournalEntry[]
  books: Book[]
  readingSessions: ReadingSession[]
  manifestations: ManifestationEntry[]
  journal: Record<string, DailyJournalEntry>
  content: ContentItem[]
  research: ResearchItem[]
  priorities: Record<string, string[]>
  trackedInstruments: string[]
}

type ListKey = {
  [K in keyof Data]: Data[K] extends { id: string }[] ? K : never
}[keyof Data]

export interface Celebration { title: string; kind: 'task' | 'focus'; detail?: string }

interface Actions {
  hydrated: boolean
  celebration: Celebration | null
  setCelebration: (c: Celebration | null) => void
  save: <K extends ListKey>(k: K, item: Data[K][number]) => void
  remove: <K extends ListKey>(k: K, id: string) => void
  updateSettings: (p: Partial<UserSettings>) => void
  // schedule
  complete: (i: ActivityInstance) => void
  skip: (i: ActivityInstance) => void
  undo: (key: string) => void
  reschedule: (i: ActivityInstance, start: string, end?: string) => void
  moveToDate: (i: ActivityInstance, target: string) => void
  addExtra: (e: Omit<ExtraActivity, 'id' | 'createdAt'>) => void
  upsertBlock: (templateId: string, block: ScheduleBlock) => void
  removeBlock: (templateId: string, blockId: string) => void
  copyTemplate: (fromId: string, toId: string) => void
  setPriorities: (date: string, items: string[]) => void
  // focus
  startFocus: (f: Omit<ActiveFocus, 'startedAt' | 'pausedTotalMs'>) => void
  pauseFocus: () => void
  resumeFocus: () => void
  setFocusMinutes: (m: number) => void
  finishFocus: (save: boolean) => FocusSession | null
  // reminders
  activateReminder: (id: string, startDate: string) => void
  reminderAction: (id: string, action: 'done' | 'skipped') => void
  snoozeReminder: (id: string, minutes: number) => void
  rescheduleReminder: (id: string, date: string) => void
  // business
  bumpSales: (date: string, field: keyof Omit<SalesDay, 'date'>, delta: number) => void
  // journal
  saveJournal: (date: string, answers: string[]) => void
  // backup
  exportJSON: () => string
  importJSON: (json: string) => { ok: boolean; error?: string }
}

export type Store = Data & Actions

const today = dateKey()

export function initialData(): Data {
  return {
    settings: defaultSettings(),
    templates: defaultTemplates(),
    overrides: [],
    extras: [],
    completions: {},
    focusSessions: [],
    activeFocus: null,
    reminders: defaultReminders().map(r =>
      r.active ? { ...r, startDate: today, nextDue: nextOccurrence(r.rule, today, today) } : r),
    leads: [],
    sales: {},
    projects: [],
    subjects: defaultSubjects(),
    studySessions: [],
    practice: [],
    trades: [],
    books: defaultBooks(),
    readingSessions: [],
    manifestations: [],
    journal: {},
    content: [],
    research: [],
    priorities: {},
    trackedInstruments: ['NIFTYBEES'],
  }
}

const DATA_KEYS = Object.keys(initialData()) as (keyof Data)[]

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialData(),
      hydrated: false,
      celebration: null,
      setCelebration: (c) => set({ celebration: c }),

      save: (k, item) => set(s => {
        const list = s[k] as { id: string }[]
        const idx = list.findIndex(x => x.id === (item as { id: string }).id)
        const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item]
        return { [k]: next } as Partial<Store>
      }),
      remove: (k, id) => set(s => ({ [k]: (s[k] as { id: string }[]).filter(x => x.id !== id) } as Partial<Store>)),
      updateSettings: (p) => set(s => ({ settings: { ...s.settings, ...p } })),

      complete: (i) => {
        const now = new Date()
        const late = i.date < dateKey(now) || (i.date === dateKey(now) && now.getHours() * 60 + now.getMinutes() > i.endMin)
        const c: ActivityCompletion = {
          id: i.key, date: i.date, blockId: i.id, title: i.title, category: i.category, status: 'done',
          at: Date.now(), scheduledStart: i.start, scheduledEnd: i.end, late,
        }
        set(s => ({ completions: { ...s.completions, [i.key]: c }, celebration: { title: i.title, kind: 'task' } }))
      },
      skip: (i) => set(s => ({
        completions: {
          ...s.completions,
          [i.key]: { id: i.key, date: i.date, blockId: i.id, title: i.title, category: i.category, status: 'skipped', at: Date.now(), scheduledStart: i.start, scheduledEnd: i.end },
        },
      })),
      undo: (key) => set(s => {
        const c = s.completions[key]
        const { [key]: _drop, ...rest } = s.completions
        void _drop
        // undoing a move also removes the carried copy (only if untouched)
        let extras = s.extras
        if (c?.status === 'moved' && c.movedTo) {
          extras = extras.filter(e => !(e.carriedFrom && e.carriedFrom.date === c.date && e.carriedFrom.blockId === c.blockId && !s.completions[`${e.date}:${e.id}`]))
        }
        return { completions: rest, extras }
      }),
      reschedule: (i, start, end) => set(s => {
        if (i.extra) {
          return { extras: s.extras.map(e => (e.id === i.id && e.date === i.date ? { ...e, start, end } : e)) }
        }
        const existing = s.overrides.find(o => o.date === i.date && o.blockId === i.id)
        const o: DayOverride = existing ? { ...existing, start, end } : { id: uid(), date: i.date, blockId: i.id, start, end, createdAt: Date.now() }
        return { overrides: existing ? s.overrides.map(x => (x.id === o.id ? o : x)) : [...s.overrides, o] }
      }),
      moveToDate: (i, target) => set(s => {
        const extra: ExtraActivity = {
          id: `carry-${uid().slice(0, 8)}`, title: i.title, category: i.category, start: i.start, end: i.end,
          description: i.description, checklist: i.checklist, focusMinutes: i.focusMinutes, module: i.module,
          date: target, carriedFrom: { date: i.date, blockId: i.id }, createdAt: Date.now(),
        }
        const c: ActivityCompletion = {
          id: i.key, date: i.date, blockId: i.id, title: i.title, category: i.category, status: 'moved',
          at: Date.now(), scheduledStart: i.start, scheduledEnd: i.end, movedTo: target,
        }
        return { extras: [...s.extras, extra], completions: { ...s.completions, [i.key]: c } }
      }),
      addExtra: (e) => set(s => ({ extras: [...s.extras, { ...e, id: `x-${uid().slice(0, 8)}`, createdAt: Date.now() }] })),
      upsertBlock: (tid, block) => set(s => ({
        templates: s.templates.map(t => t.id !== tid ? t : {
          ...t, updatedAt: Date.now(),
          blocks: t.blocks.some(b => b.id === block.id) ? t.blocks.map(b => (b.id === block.id ? block : b)) : [...t.blocks, block],
        }),
      })),
      removeBlock: (tid, bid) => set(s => ({
        templates: s.templates.map(t => (t.id !== tid ? t : { ...t, updatedAt: Date.now(), blocks: t.blocks.filter(b => b.id !== bid) })),
      })),
      copyTemplate: (fromId, toId) => set(s => {
        const from = s.templates.find(t => t.id === fromId)
        if (!from) return {}
        return { templates: s.templates.map(t => (t.id === toId ? { ...t, blocks: from.blocks.map(b => ({ ...b })), updatedAt: Date.now() } : t)) }
      }),
      setPriorities: (date, items) => set(s => ({ priorities: { ...s.priorities, [date]: items } })),

      startFocus: (f) => set({ activeFocus: { ...f, startedAt: Date.now(), pausedTotalMs: 0 } }),
      pauseFocus: () => set(s => (s.activeFocus && !s.activeFocus.pausedAt ? { activeFocus: { ...s.activeFocus, pausedAt: Date.now() } } : {})),
      resumeFocus: () => set(s => {
        const f = s.activeFocus
        if (!f?.pausedAt) return {}
        return { activeFocus: { ...f, pausedAt: undefined, pausedTotalMs: f.pausedTotalMs + (Date.now() - f.pausedAt) } }
      }),
      setFocusMinutes: (m) => set(s => (s.activeFocus ? { activeFocus: { ...s.activeFocus, plannedMinutes: m } } : {})),
      finishFocus: (save) => {
        const f = get().activeFocus
        if (!f) return null
        const end = f.pausedAt ?? Date.now()
        const elapsedMs = end - f.startedAt - f.pausedTotalMs
        const actual = Math.min(f.plannedMinutes, Math.round(elapsedMs / 60000))
        let session: FocusSession | null = null
        if (save && actual >= 1) {
          session = {
            id: uid(), date: dateKey(new Date(f.startedAt)), startedAt: f.startedAt, endedAt: end,
            plannedMinutes: f.plannedMinutes, actualMinutes: actual, instanceKey: f.instanceKey,
            label: f.label, category: f.category, completed: elapsedMs >= f.plannedMinutes * 60000 - 1000,
          }
        }
        set(s => ({ activeFocus: null, focusSessions: session ? [...s.focusSessions, session] : s.focusSessions }))
        return session
      },

      activateReminder: (id, startDate) => set(s => ({
        reminders: s.reminders.map(r => (r.id !== id ? r : { ...r, active: true, startDate, nextDue: firstDue(r.rule, startDate, dateKey()) })),
      })),
      reminderAction: (id, action) => set(s => ({
        reminders: s.reminders.map(r => {
          if (r.id !== id || !r.nextDue) return r
          const t = dateKey()
          return {
            ...r, snoozedUntil: undefined, nextDue: afterAction(r, t),
            history: [...r.history, { at: Date.now(), action, dueDate: r.nextDue }],
          }
        }),
      })),
      snoozeReminder: (id, minutes) => set(s => ({
        reminders: s.reminders.map(r => (r.id !== id ? r : {
          ...r, snoozedUntil: Date.now() + minutes * 60000,
          history: [...r.history, { at: Date.now(), action: 'snoozed', dueDate: r.nextDue ?? dateKey() }],
        })),
      })),
      rescheduleReminder: (id, date) => set(s => ({
        reminders: s.reminders.map(r => (r.id !== id ? r : {
          ...r, nextDue: date, snoozedUntil: undefined,
          history: [...r.history, { at: Date.now(), action: 'rescheduled', dueDate: r.nextDue ?? date }],
        })),
      })),

      bumpSales: (date, field, delta) => set(s => {
        const d = s.sales[date] ?? { date, calls: 0, dms: 0, interested: 0, meetings: 0, proposals: 0, won: 0 }
        return { sales: { ...s.sales, [date]: { ...d, [field]: Math.max(0, d[field] + delta) } } }
      }),
      saveJournal: (date, answers) => set(s => ({ journal: { ...s.journal, [date]: { date, answers, updatedAt: Date.now() } } })),

      exportJSON: () => {
        const s = get()
        const data: Partial<Data> = {}
        for (const k of DATA_KEYS) (data as Record<string, unknown>)[k] = s[k]
        return JSON.stringify({ app: 'kairo', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
      },
      importJSON: (json) => {
        try {
          const parsed = JSON.parse(json)
          const data = parsed?.data ?? parsed
          if (typeof data !== 'object' || !data) return { ok: false, error: 'Not a Kairo backup.' }
          const base = initialData()
          const patch: Partial<Data> = {}
          for (const k of DATA_KEYS) if (k in data) (patch as Record<string, unknown>)[k] = data[k]
          if (!Object.keys(patch).length) return { ok: false, error: 'No recognisable Kairo data in this file.' }
          set({ ...base, ...patch } as Partial<Store>)
          return { ok: true }
        } catch (e) {
          return { ok: false, error: (e as Error).message }
        }
      },
    }),
    {
      name: 'kairo-v1',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const out: Partial<Data> = {}
        for (const k of DATA_KEYS) (out as Record<string, unknown>)[k] = s[k]
        return out as Store
      },
      // Future schema changes: transform old state here; never drop user records.
      migrate: (persisted) => ({ ...initialData(), ...(persisted as Partial<Data>) }) as Store,
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Data>) }),
      onRehydrateStorage: () => () => { useStore.setState({ hydrated: true }) },
    },
  ),
)
