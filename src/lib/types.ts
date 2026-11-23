export type Category =
  | 'Personal' | 'Reading' | 'Mindset' | 'Education' | 'Trading' | 'Fitness'
  | 'Development' | 'Research' | 'Business' | 'Content' | 'Reflection' | 'Recovery' | 'Other'

export type ID = string

/** A block in a schedule template. Times are "HH:MM" in local (device) time. */
export interface ScheduleBlock {
  id: ID
  title: string
  category: Category
  start: string
  end?: string // point-in-time tasks (wake/sleep) omit end
  description?: string
  checklist?: string[]
  focusMinutes?: number // auto-associated focus preset
  module?: 'study' | 'reading' | 'trading' | 'manifest' | 'journal' | 'content' | 'business' | 'research'
}

export interface ScheduleTemplate {
  id: ID
  name: string
  kind: 'weekday' | 'weekend'
  blocks: ScheduleBlock[]
  updatedAt: number
}

/** Per-date change that never mutates the master template. */
export interface DayOverride {
  id: ID
  date: string // YYYY-MM-DD
  blockId: ID
  start?: string
  end?: string
  title?: string
  removed?: boolean
  createdAt: number
}

/** One-off activity on a specific date (added task or carried-forward task). */
export interface ExtraActivity extends ScheduleBlock {
  date: string
  carriedFrom?: { date: string; blockId: ID }
  createdAt: number
}

export type CompletionStatus = 'done' | 'skipped' | 'moved'

export interface ActivityCompletion {
  id: ID // `${date}:${blockId}`
  date: string
  blockId: ID
  title: string
  category: Category
  status: CompletionStatus
  at: number
  scheduledStart: string
  scheduledEnd?: string
  movedTo?: string
  late?: boolean // completed after the window closed ("Complete now")
}

export type InstanceStatus = 'upcoming' | 'active' | 'overdue' | 'done' | 'skipped' | 'moved'

export interface ActivityInstance extends ScheduleBlock {
  key: string // `${date}:${blockId}`
  date: string
  startMin: number
  endMin: number
  status: InstanceStatus
  rescheduled: boolean
  extra: boolean
  completion?: ActivityCompletion
}

export interface FocusSession {
  id: ID
  date: string
  startedAt: number
  endedAt: number
  plannedMinutes: number
  actualMinutes: number
  instanceKey?: string
  label: string
  category: Category
  completed: boolean // reached planned duration
  distractions?: number
}

export interface ActiveFocus {
  startedAt: number
  plannedMinutes: number
  pausedAt?: number
  pausedTotalMs: number
  instanceKey?: string
  label: string
  category: Category
  distractions?: number
}

export type RecurrenceRule =
  | { type: 'daily' }
  | { type: 'everyNDays'; n: number }
  | { type: 'weekly'; weekdays: number[] } // 0=Sun
  | { type: 'monthly'; day: number }
  | { type: 'everyNMonths'; n: number }

export interface ReminderEvent { at: number; action: 'done' | 'skipped' | 'snoozed' | 'rescheduled'; dueDate: string }

export interface Reminder {
  id: ID
  title: string
  rule: RecurrenceRule
  time: string // HH:MM
  startDate: string | null // null => awaiting user's chosen start date
  nextDue: string | null // YYYY-MM-DD
  snoozedUntil?: number
  active: boolean
  notify: boolean
  linkedBlockId?: ID
  history: ReminderEvent[]
  createdAt: number
}

export type LeadStage = 'New' | 'Contacted' | 'Interested' | 'Demo' | 'Proposal' | 'Won' | 'Lost'
export const LEAD_STAGES: LeadStage[] = ['New', 'Contacted', 'Interested', 'Demo', 'Proposal', 'Won', 'Lost']

export interface BusinessLead {
  id: ID
  businessName: string
  contactName?: string
  phone?: string
  email?: string
  instagram?: string
  industry?: string
  source?: string
  stage: LeadStage
  lastContact?: string
  nextFollowUp?: string
  notes?: string
  quotedAmount?: number
  createdAt: number
  updatedAt: number
}

export interface SalesDay {
  date: string
  calls: number
  dms: number
  interested: number
  meetings: number
  proposals: number
  won: number
}

export interface Milestone { id: ID; title: string; due?: string; done: boolean }
export interface Revision { id: ID; text: string; done: boolean; createdAt: number }

export interface ClientProject {
  id: ID
  name: string
  client: string
  status: 'Planning' | 'In progress' | 'Review' | 'Delivered' | 'On hold'
  deadline?: string
  value?: number
  paid?: number
  milestones: Milestone[]
  revisions: Revision[]
  notes?: string
  createdAt: number
}

export interface StudyChapter { id: ID; name: string; done: boolean; revisions: number; doneAt?: number; revisedAt?: number[] }
export interface StudySubject { id: ID; name: string; chapters: StudyChapter[]; archived?: boolean }
export interface StudySession {
  id: ID; date: string; subjectId: ID; chapterId?: ID; minutes: number; topics?: string; notes?: string; createdAt: number
}
export interface PracticeAnswer {
  id: ID; date: string; subjectId: ID; question: string; answer: string
  score?: number // out of 10, self or assessed
  deductions?: string; improvements?: string; createdAt: number
}

export interface TradeJournalEntry {
  id: ID
  date: string
  kind: 'paper' | 'real'
  instrument: string
  direction: 'Long' | 'Short'
  setup?: string
  entry?: number
  stopLoss?: number
  target?: number
  exit?: number
  quantity?: number
  outcome: 'Open' | 'Win' | 'Loss' | 'Breakeven'
  screenshots: string[] // data URLs (compressed)
  notes?: string
  mistakes?: string
  lessons?: string
  createdAt: number
}

export interface Book {
  id: ID; title: string; author?: string; totalPages: number; currentPage: number
  slot: 'morning' | 'evening' | 'any'; status: 'reading' | 'finished' | 'archived'; createdAt: number
}
export interface ReadingSession {
  id: ID; date: string; bookId: ID; slot: 'morning' | 'evening' | 'other'; pagesFrom: number; pagesTo: number
  minutes: number; notes?: string; takeaways?: string; createdAt: number
}

export type ManifestSlot = 'morning' | 'evening' | 'night'
export interface ManifestationEntry {
  id: ID; date: string; slot: ManifestSlot; affirmations: string; goals: string; journal: string; done: boolean; at: number
}

export interface DailyJournalEntry { date: string; answers: string[]; updatedAt: number }

export type ContentStatus = 'Idea' | 'Scripted' | 'Recorded' | 'Edited' | 'Scheduled' | 'Published'
export interface ContentItem {
  id: ID; title: string; format: 'Reel' | 'Post' | 'Story' | 'Video'; script?: string; status: ContentStatus
  publishDate?: string; performance?: string; notes?: string; createdAt: number
}

export interface ResearchItem { id: ID; title: string; url?: string; tags?: string; notes?: string; date: string; createdAt: number }

export interface DayPriorities { date: string; items: string[] }

export interface UserSettings {
  name: string
  timezone: string
  notifications: boolean
  reducedMotion: 'system' | 'on' | 'off'
  weekendDays: number[]
  overdueGraceMin: number
}

// ---------- Health ----------
export type BulkGoal = 'lean-bulk' | 'bulk' | 'maintain'
export interface HealthProfile {
  weightKg?: number
  heightCm?: number
  age?: number
  sex?: 'male' | 'female'
  goal: BulkGoal
  sleepGoalMin: number
  /** applied from the bulk tracker's weekly weight-trend advice */
  kcalAdjust?: number
  /** Bulk Boost preferences */
  diet?: DietType
  whey?: boolean
  excludeFoods?: string[]
}
export type DietType = 'veg' | 'egg' | 'nonveg'
export interface FoodItem { name: string; grams?: number; kcal: number; protein: number; carbs: number; fat: number; /** Bulk Boost food id when added as an add-on */ boost?: string }
export interface MealEntry {
  id: ID
  date: string
  at: number
  title: string
  photo?: string // compressed data URL, stays on device
  items: FoodItem[]
  kcal: number; protein: number; carbs: number; fat: number
  source: 'ai' | 'manual'
  appetiteBefore?: number // 1–5
  appetiteAfter?: number
  notes?: string
}
export interface AppetiteLog { id: ID; at: number; date: string; level: number } // 1 none … 5 starving
export interface SleepRecord {
  id: ID
  date: string // morning (wake) date
  sleepStart: number
  wake: number
  asleepMin: number
  wakeUps: number
  score: number
  rested?: number // 1–5 check-in
  source: 'auto' | 'manual'
  timeline?: { start: number; end: number; type: 'idle' | 'used' }[]
}

// ---------- Productivity+ ----------
export interface WeightEntry { id: ID; date: string; kg: number }
export interface WorkoutSet { reps: number; kg: number }
export interface WorkoutExercise { name: string; sets: WorkoutSet[]; /** exercise-library id */ exId?: string; muscle?: string }
export interface Workout { id: ID; date: string; title?: string; exercises: WorkoutExercise[]; notes?: string; createdAt: number; muscles?: string[]; durationMin?: number }
export interface EnergyLog { id: ID; at: number; date: string; level: 1 | 2 | 3; instanceKey?: string; category?: Category }
export interface Expense { id: ID; date: string; amount: number; category: string; note?: string; createdAt: number }
export interface QuarterGoal {
  id: ID; title: string; quarter: string // e.g. 2026-Q4
  categories: Category[] // tasks/focus in these categories count as progress
  milestones: { id: ID; title: string; done: boolean }[]
  createdAt: number
}
export interface Targets2 {
  outreachCalls: number; outreachDms: number; waterGlasses: number
  savingsGoal?: number; monthlyBudget?: number; niosExamDate?: string
}
