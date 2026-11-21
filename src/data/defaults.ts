import type { Reminder, ScheduleBlock, ScheduleTemplate, StudySubject, Book, UserSettings } from '../lib/types'

const b = (id: string, start: string, end: string | undefined, title: string, category: ScheduleBlock['category'], extra: Partial<ScheduleBlock> = {}): ScheduleBlock =>
  ({ id, start, end, title, category, ...extra })

/** The user's exact weekday timetable (Asia/Kolkata, device clock). Gaps are free time. */
export const WEEKDAY_BLOCKS: ScheduleBlock[] = [
  b('wake', '05:00', undefined, 'Wake up and hydrate', 'Personal', { description: 'Glass of water before anything else.' }),
  b('read-am', '05:15', '05:45', 'Morning reading', 'Reading', { module: 'reading' }),
  b('manifest-am', '06:00', '06:15', 'Morning manifestation', 'Mindset', { module: 'manifest' }),
  b('study', '06:15', '07:15', 'NIOS study session', 'Education', { module: 'study', focusMinutes: 60 }),
  b('trade-practice', '07:15', '07:45', 'Trading practice', 'Trading', { module: 'trading' }),
  b('gym', '07:45', '08:45', 'Gym and cardio', 'Fitness'),
  b('dev', '09:15', '11:15', 'Deep development work', 'Development', { focusMinutes: 120 }),
  b('research', '11:30', '12:30', 'Research', 'Research', { module: 'research', focusMinutes: 60 }),
  b('outreach', '13:00', '14:30', 'Cold calling and Instagram outreach', 'Business', { module: 'business' }),
  b('meetings', '14:30', '15:15', 'Client meetings and proposals', 'Business', { module: 'business' }),
  b('record', '15:15', '16:00', 'Content recording', 'Content', { module: 'content' }),
  b('edit', '16:00', '17:00', 'Video editing', 'Content', { module: 'content' }),
  b('crm', '17:00', '17:45', 'Client development and CRM', 'Business', { module: 'business' }),
  b('manifest-pm', '18:00', '18:15', 'Evening manifestation', 'Mindset', { module: 'manifest' }),
  b('trade-journal', '19:30', '20:00', 'Trading journal', 'Trading', { module: 'trading' }),
  b('read-pm', '20:00', '20:30', 'Evening reading', 'Reading', { module: 'reading', description: 'The Psychology of Money' }),
  b('journal', '20:30', '21:00', 'Daily journaling', 'Reflection', { module: 'journal' }),
  b('manifest-night', '21:15', '21:30', 'Night manifestation', 'Mindset', { module: 'manifest' }),
  b('sleep', '21:30', undefined, 'Sleep', 'Recovery', { description: 'Screens off. Recover for tomorrow.' }),
]

/** Weekend starts as an editable copy of the weekday routine (user can trim it in Timetable). */
export const defaultTemplates = (): ScheduleTemplate[] => [
  { id: 'tpl-weekday', name: 'Weekday', kind: 'weekday', blocks: WEEKDAY_BLOCKS.map(x => ({ ...x })), updatedAt: Date.now() },
  { id: 'tpl-weekend', name: 'Weekend', kind: 'weekend', blocks: WEEKDAY_BLOCKS.map(x => ({ ...x })), updatedAt: Date.now() },
]

/** Interval reminders start with startDate=null: user picks the start date (no invented due dates). */
export const defaultReminders = (): Reminder[] => {
  const now = Date.now()
  const r = (id: string, title: string, rule: Reminder['rule'], time: string, linkedBlockId?: string, pending = false): Reminder => ({
    id, title, rule, time, linkedBlockId, active: !pending, notify: true, history: [], createdAt: now,
    startDate: null, nextDue: null,
  })
  return [
    r('rem-pillow', 'Replace pillow cover', { type: 'everyNDays', n: 3 }, '20:45', undefined, true),
    r('rem-towel', 'Replace towel', { type: 'everyNDays', n: 3 }, '07:30', undefined, true),
    r('rem-body', 'Weekly body measurement', { type: 'weekly', weekdays: [0] }, '07:00', undefined, true),
    r('rem-brush', 'Replace toothbrush', { type: 'everyNMonths', n: 6 }, '05:05', undefined, true),
    r('rem-study', 'Study session', { type: 'weekly', weekdays: [1, 2, 3, 4, 5] }, '06:10', 'study'),
    r('rem-gym', 'Gym', { type: 'weekly', weekdays: [1, 2, 3, 4, 5] }, '07:40', 'gym'),
    r('rem-reading', 'Evening reading', { type: 'daily' }, '19:55', 'read-pm'),
    r('rem-manifest', 'Manifestation', { type: 'daily' }, '05:58', 'manifest-am'),
    r('rem-followups', 'Client follow-ups', { type: 'weekly', weekdays: [1, 2, 3, 4, 5] }, '16:55', 'crm'),
  ]
}

export const defaultSubjects = (): StudySubject[] =>
  ['English', 'Mathematics', 'Business Studies', 'Economics', 'Data Entry Operations'].map((name, i) => ({
    id: `sub-${i}`, name, chapters: [],
  }))

export const defaultBooks = (): Book[] => [
  { id: 'book-pom', title: 'The Psychology of Money', author: 'Morgan Housel', totalPages: 256, currentPage: 0, slot: 'evening', status: 'reading', createdAt: Date.now() },
]

export const defaultSettings = (): UserSettings => ({
  name: '',
  timezone: 'Asia/Kolkata',
  notifications: false,
  reducedMotion: 'system',
  weekendDays: [0, 6],
  overdueGraceMin: 10,
})

export const JOURNAL_QUESTIONS = [
  'What did I accomplish today?',
  'What was my biggest win?',
  'What did I struggle with?',
  'What did I learn?',
  'How did I perform in my business?',
  'What can I improve tomorrow?',
  "What are tomorrow's top priorities?",
]
