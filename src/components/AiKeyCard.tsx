import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { getXaiKey, getXaiModel, providerName, setXaiKey, setXaiModel } from '../lib/vision'
import { Card, Field, Pill } from './ui'

/** xAI key is stored only in this phone's localStorage — not in backups, GitHub or Vercel. */
export function AiKeyCard() {
  const [key, setKey] = useState(getXaiKey())
  const [model, setModel] = useState(getXaiModel())
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const saved = !!getXaiKey()
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} className="text-peach" /> AI key {saved && <span className="text-[11px] text-success font-bold">· {providerName()} saved</span>}</div>
      <div className="relative">
        <input className="field !pr-10" type={show ? 'text' : 'password'} placeholder="gsk_… (Groq) or xai-… (Grok)" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} />
        <button onClick={() => setShow(v => !v)} aria-label={show ? 'Hide key' : 'Show key'} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </div>
      <Field label="Model (optional — leave blank for automatic)"><input className="field" placeholder={key.startsWith('gsk_') ? 'qwen/qwen3.8-27b' : 'grok-4'} value={model} onChange={e => setModel(e.target.value)} /></Field>
      <div className="flex gap-2">
        <Pill variant="lavender" className="flex-1" onClick={() => { setXaiKey(key); setXaiModel(model); setMsg(key.trim() ? 'Saved on this phone.' : 'Key removed.') }}>Save</Pill>
        {saved && <Pill variant="danger" onClick={() => { setXaiKey(''); setKey(''); setMsg('Key removed from this phone.') }}>Remove</Pill>}
      </div>
      {msg && <div className="text-xs text-lavender">{msg}</div>}
      <p className="text-[11px] text-ink-3 leading-relaxed">Stored only on this phone — never in backups, GitHub or Vercel. Works with a Groq key (gsk_…, Qwen 3.8 vision, has a free tier) or an xAI Grok key (xai-…). Meal photos go through Kairo’s private relay to that provider and aren’t stored.</p>
    </Card>
  )
}
