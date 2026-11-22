import { create } from 'zustand'
import { useStore, initialData, type Data } from '../store/useStore'

/**
 * Kairo cloud sync — Neon Postgres behind Kairo's own Vercel functions (/api/auth, /api/sync).
 * One row per account. The whole Kairo store is synced as JSON except meal photos and trade screenshots
 * (kept on each device) and the AI key (never leaves the phone). Last-write-wins with an explicit choice on conflicts.
 */
export const cloudConfigured = true
const AUTH_KEY = 'kairo-auth'
interface Session { token: string; email: string }
const readSession = (): Session | null => { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') } catch { return null } }
const writeSession = (s: Session | null) => { try { s ? localStorage.setItem(AUTH_KEY, JSON.stringify(s)) : localStorage.removeItem(AUTH_KEY) } catch { /* ignore */ } }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useCloud.getState().session?.token
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } })
  const body = await r.json().catch(() => ({}))
  if (r.status === 401 && token) { writeSession(null); useCloud.setState({ session: null, status: 'idle' }) }
  if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`)
  return body as T
}

const DEVICE_KEY = 'kairo-device-id'
const META_KEY = 'kairo-sync-meta'
export const deviceId = (() => {
  try {
    let d = localStorage.getItem(DEVICE_KEY)
    if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem(DEVICE_KEY, d) }
    return d
  } catch { return 'unknown' }
})()
interface Meta { remoteAt?: string; dirty?: boolean }
const readMeta = (): Meta => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') } catch { return {} } }
const writeMeta = (m: Meta) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)) } catch { /* ignore */ } }

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'error' | 'conflict'
interface CloudState {
  session: Session | null
  status: SyncStatus
  lastSync?: string
  error?: string
  conflict?: { remoteAt: string; remoteDevice: string; remote: Partial<Data> }
}
export const useCloud = create<CloudState>(() => ({ session: readSession(), status: 'idle' }))

/* ---------- snapshot helpers ---------- */

function snapshot(): Partial<Data> {
  const all = JSON.parse(useStore.getState().exportJSON()).data as Data
  return {
    ...all,
    activeFocus: null, // a running timer belongs to one device
    meals: all.meals.map(({ photo: _p, ...m }) => m),
    trades: all.trades.map(t => ({ ...t, screenshots: [] })),
  }
}

export const hasMeaningfulData = (d: Partial<Data>) =>
  Object.keys(d.completions ?? {}).length + (d.meals?.length ?? 0) + (d.focusSessions?.length ?? 0) + (d.leads?.length ?? 0) +
  Object.keys(d.journal ?? {}).length + (d.trades?.length ?? 0) + (d.sleeps?.length ?? 0) + (d.studySessions?.length ?? 0) > 0

let applying = false
function applyRemote(remote: Partial<Data>) {
  const local = useStore.getState()
  const photos = new Map(local.meals.filter(m => m.photo).map(m => [m.id, m.photo]))
  const shots = new Map(local.trades.filter(t => t.screenshots.length).map(t => [t.id, t.screenshots]))
  applying = true
  useStore.setState({
    ...initialData(),
    ...remote,
    activeFocus: local.activeFocus,
    meals: (remote.meals ?? []).map(m => ({ ...m, photo: photos.get(m.id) })),
    trades: (remote.trades ?? []).map(t => ({ ...t, screenshots: shots.get(t.id) ?? [] })),
  })
  applying = false
}

/* ---------- push / pull ---------- */

async function pull() {
  if (!useCloud.getState().session) return null
  return api<{ data: Partial<Data>; updated_at: string; device: string } | null>('/api/sync')
}

export async function push() {
  if (!useCloud.getState().session) return
  useCloud.setState({ status: 'syncing', error: undefined })
  try {
    const { updated_at } = await api<{ updated_at: string }>('/api/sync', { method: 'PUT', body: JSON.stringify({ data: snapshot(), device: deviceId }) })
    writeMeta({ remoteAt: updated_at, dirty: false })
    useCloud.setState({ status: 'synced', lastSync: updated_at })
  } catch (e) { useCloud.setState({ status: 'error', error: (e as Error).message }) }
}

/** Reconcile this device with the cloud (on sign-in, on app open, when returning to the app). */
export async function reconcile(firstSignIn = false) {
  if (!useCloud.getState().session) return
  try {
    useCloud.setState({ status: 'syncing', error: undefined })
    const remote = await pull()
    const meta = readMeta()
    if (!remote) { await push(); return }
    const remoteNewer = !meta.remoteAt || remote.updated_at > meta.remoteAt
    const fromOtherDevice = remote.device !== deviceId
    const localHas = hasMeaningfulData(useStore.getState())
    if (firstSignIn && !meta.remoteAt) {
      if (!localHas) { applyRemote(remote.data); writeMeta({ remoteAt: remote.updated_at, dirty: false }); useCloud.setState({ status: 'synced', lastSync: remote.updated_at }); return }
      if (!hasMeaningfulData(remote.data)) { await push(); return }
      useCloud.setState({ status: 'conflict', conflict: { remoteAt: remote.updated_at, remoteDevice: remote.device, remote: remote.data } })
      return
    }
    if (remoteNewer && fromOtherDevice) {
      if (meta.dirty) { useCloud.setState({ status: 'conflict', conflict: { remoteAt: remote.updated_at, remoteDevice: remote.device, remote: remote.data } }); return }
      applyRemote(remote.data)
      writeMeta({ remoteAt: remote.updated_at, dirty: false })
      useCloud.setState({ status: 'synced', lastSync: remote.updated_at })
      return
    }
    if (meta.dirty) await push()
    else useCloud.setState({ status: 'synced', lastSync: meta.remoteAt })
  } catch (e) {
    useCloud.setState({ status: 'error', error: (e as Error).message })
  }
}

export async function resolveConflict(keep: 'cloud' | 'device') {
  const c = useCloud.getState().conflict
  if (!c) return
  if (keep === 'cloud') { applyRemote(c.remote); writeMeta({ remoteAt: c.remoteAt, dirty: false }); useCloud.setState({ conflict: undefined, status: 'synced', lastSync: c.remoteAt }) }
  else { useCloud.setState({ conflict: undefined }); await push() }
}

/* ---------- auth ---------- */

async function auth(action: 'signin' | 'signup', email: string, password: string) {
  const r = await api<Session>('/api/auth', { method: 'POST', body: JSON.stringify({ action, email, password }) })
  writeSession(r)
  writeMeta({})
  useCloud.setState({ session: r })
  await reconcile(true)
}
export const signIn = (email: string, password: string) => auth('signin', email, password)
export async function signUp(email: string, password: string) { await auth('signup', email, password); return 'signed-in' as const }

export async function signOut() {
  if (readMeta().dirty) await push().catch(() => {})
  writeSession(null)
  writeMeta({})
  useCloud.setState({ session: null, status: 'idle', lastSync: undefined, conflict: undefined })
}

/** Start once at app boot (after the store has hydrated). */
let started = false
export function startCloudSync() {
  if (started) return
  started = true
  if (useCloud.getState().session) reconcile()
  // local changes → mark dirty → debounced push
  let t: number | undefined
  useStore.subscribe((s, prev) => {
    if (applying || !useCloud.getState().session || s === prev) return
    if (s.celebration !== prev.celebration && s.completions === prev.completions) return // UI-only change
    writeMeta({ ...readMeta(), dirty: true })
    clearTimeout(t)
    t = window.setTimeout(() => { if (useCloud.getState().status !== 'conflict') push() }, 3000)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reconcile()
    else if (readMeta().dirty && useCloud.getState().status !== 'conflict') push()
  })
}
