import { motion } from 'framer-motion'
import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { cloudConfigured, reconcile, resolveConflict, signIn, signOut, signUp, useCloud } from '../lib/cloud'
import { Card, Field, Pill, Segmented } from './ui'

const ago = (iso?: string) => {
  if (!iso) return 'not yet'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

export function AccountCard() {
  const { session, status, lastSync, error, conflict } = useCloud()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!cloudConfigured) return (
    <Card className="flex gap-3 items-start text-sm"><CloudOff size={18} className="text-ink-3 mt-0.5" />
      <div><b>Cloud sync isn’t connected yet.</b><div className="text-xs text-ink-2 mt-0.5">Your data is safe on this phone. Use Backup → Export in the meantime.</div></div></Card>
  )

  if (session) return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full grid place-items-center bg-success/15"><Cloud size={18} className="text-success" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{session.user.email}</div>
          <div className={`text-[11px] font-semibold ${status === 'error' ? 'text-danger' : status === 'conflict' ? 'text-warning' : 'text-ink-2'}`}>
            {status === 'syncing' ? 'Syncing…' : status === 'error' ? `Sync error: ${error}` : status === 'conflict' ? 'Choose which data to keep' : `Synced ${ago(lastSync)}`}
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => reconcile()} aria-label="Sync now" className="glass size-9 rounded-full grid place-items-center">
          <RefreshCw size={15} className={status === 'syncing' ? 'animate-spin' : ''} />
        </motion.button>
      </div>
      {conflict && (
        <div className="rounded-2xl border border-warning/35 bg-warning/10 p-3 space-y-2">
          <div className="text-sm font-bold text-warning">This phone and your cloud data are different</div>
          <div className="text-xs text-ink-2">Cloud copy saved {ago(conflict.remoteAt)} from another device. Which one should Kairo keep everywhere?</div>
          <div className="flex gap-2">
            <Pill variant="lavender" className="flex-1 h-9 text-xs" onClick={() => resolveConflict('cloud')}>Use cloud data</Pill>
            <Pill className="flex-1 h-9 text-xs" onClick={() => { if (window.confirm("Replace the cloud copy with this phone's data?")) resolveConflict('device') }}>Keep this phone’s</Pill>
          </div>
        </div>
      )}
      <p className="text-[11px] text-ink-3 leading-relaxed">Everything syncs except meal photos and trade screenshots (they stay on each phone) and your AI key.</p>
      <Pill className="w-full" onClick={async () => { await signOut(); setMsg('Signed out — your data stays on this phone.') }}><LogOut size={15} /> Sign out</Pill>
      {msg && <div className="text-xs text-lavender">{msg}</div>}
    </Card>
  )

  const go = async () => {
    setBusy(true); setMsg(null)
    try {
      if (mode === 'in') await signIn(email.trim(), pw)
      else if ((await signUp(email.trim(), pw)) === 'confirm-email') setMsg('Check your email and tap the confirmation link, then sign in here.')
    } catch (e) {
      const m = (e as Error).message
      setMsg(/invalid login/i.test(m) ? 'Wrong email or password.' : /already registered/i.test(m) ? 'That email already has an account — sign in instead.' : m)
    } finally { setBusy(false) }
  }
  return (
    <Card className="space-y-3">
      <div className="text-sm"><b>Sign in to sync</b><div className="text-xs text-ink-2">Use the same account on any phone to get all your Kairo data back.</div></div>
      <Segmented value={mode} onChange={setMode} options={[{ v: 'in', l: 'Sign in' }, { v: 'up', l: 'Create account' }]} />
      <Field label="Email"><input type="email" autoComplete="email" className="field" value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label={mode === 'up' ? 'Password (8+ characters)' : 'Password'}><input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} className="field" value={pw} onChange={e => setPw(e.target.value)} /></Field>
      <Pill variant="lavender" className="w-full h-11" disabled={busy || !/\S+@\S+\.\S+/.test(email) || pw.length < (mode === 'up' ? 8 : 1)} onClick={go}>
        {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </Pill>
      {msg && <div className="text-xs text-warning">{msg}</div>}
    </Card>
  )
}
