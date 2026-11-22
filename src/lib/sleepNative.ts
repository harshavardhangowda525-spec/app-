import { Capacitor, registerPlugin } from '@capacitor/core'
import type { ScreenEvent } from './health'

interface SleepTrackerPlugin {
  hasPermission(): Promise<{ granted: boolean }>
  openPermissionSettings(): Promise<void>
  getScreenEvents(o: { from: number; to: number }): Promise<{ events: ScreenEvent[] }>
}
const SleepTracker = registerPlugin<SleepTrackerPlugin>('SleepTracker')

/** Automatic sleep tracking exists only in the Android app (needs screen history the web can't see). */
export const sleepAvailable = () => Capacitor.getPlatform() === 'android'
export const sleepPermission = async () => (sleepAvailable() ? (await SleepTracker.hasPermission()).granted : false)
export const openUsageAccess = () => SleepTracker.openPermissionSettings()
export const screenEvents = async (from: number, to: number) => (await SleepTracker.getScreenEvents({ from, to })).events
