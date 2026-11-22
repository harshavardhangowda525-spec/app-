import { create } from 'zustand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

import { Capacitor } from '@capacitor/core'

export const isInstalled = () =>
  Capacitor.isNativePlatform() ||
  matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

interface InstallState {
  deferred: BeforeInstallPromptEvent | null
  installed: boolean
  dismissedAt: number
  /** 'prompt' = native install dialog available; 'ios' = manual Share → Add to Home Screen; 'manual' = use browser menu */
  mode: () => 'prompt' | 'ios' | 'manual' | 'installed'
  install: () => Promise<boolean>
  dismiss: () => void
}

const DISMISS_KEY = 'kairo-install-dismissed'
const readDismiss = () => { try { return Number(localStorage.getItem(DISMISS_KEY)) || 0 } catch { return 0 } }

export const useInstall = create<InstallState>((set, get) => ({
  deferred: null,
  installed: typeof window !== 'undefined' && isInstalled(),
  dismissedAt: typeof window !== 'undefined' ? readDismiss() : 0,
  mode: () => (get().installed ? 'installed' : get().deferred ? 'prompt' : isIOS() ? 'ios' : 'manual'),
  install: async () => {
    const e = get().deferred
    if (!e) return false
    await e.prompt()
    const { outcome } = await e.userChoice
    set({ deferred: null, installed: outcome === 'accepted' })
    return outcome === 'accepted'
  },
  dismiss: () => { const t = Date.now(); try { localStorage.setItem(DISMISS_KEY, String(t)) } catch { /* ignore */ } set({ dismissedAt: t }) },
}))

/** Capture Chrome's install event early (it can fire before React mounts). */
export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    useInstall.setState({ deferred: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, deferred: null }))
  matchMedia('(display-mode: fullscreen)').addEventListener?.('change', () => useInstall.setState({ installed: isInstalled() }))
}
