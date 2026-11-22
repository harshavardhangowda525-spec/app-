import { create } from 'zustand'
import type { Category } from '../lib/types'

export interface FocusDraft { label: string; category: Category; minutes: number; instanceKey?: string }

export type Tab = 'today' | 'focus' | 'health' | 'business' | 'projects' | 'insights' | 'more'
export type Page =
  | 'projects' | 'content' | 'trading' | 'research' | 'study' | 'reading' | 'manifest' | 'journal' | 'habits' | 'settings' | 'timetable'

interface Nav {
  tab: Tab
  page: Page | null
  dir: 1 | -1
  focusDraft: FocusDraft | null
  openFocus: (d: FocusDraft) => void
  setTab: (t: Tab) => void
  open: (p: Page) => void
  back: () => void
}

export const useNav = create<Nav>((set) => ({
  tab: 'today',
  page: null,
  dir: 1,
  focusDraft: null,
  openFocus: (focusDraft) => set({ focusDraft, tab: 'focus', page: null }),
  setTab: (tab) => set({ tab, page: null, dir: 1 }),
  open: (page) => set({ page, dir: 1 }),
  back: () => set({ page: null, dir: -1 }),
}))
