import { Bell, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Card, Field, Pill, ScreenHeader, Section, Segmented } from '../components/ui'
import { isNative, requestPermission } from '../lib/notify'
import { dateKey } from '../lib/time'
import { useStore } from '../store/useStore'
import { InstallButton } from '../components/InstallBanner'
import { AiKeyCard } from '../components/AiKeyCard'
import { AccountCard } from '../components/AccountCard'

export default function Settings() {
  const settings = useStore(s => s.settings)
  const update = useStore(s => s.updateSettings)
  const exportJSON = useStore(s => s.exportJSON)
  const importJSON = useStore(s => s.importJSON)
  const instruments = useStore(s => s.trackedInstruments)
  const [msg, setMsg] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kairo-backup-${dateKey()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMsg('Backup downloaded.')
  }

  return (
    <div className="space-y-4">
      <ScreenHeader back kicker="Kairo" title="Settings" />
      <Section title="Account & sync">
        <AccountCard />
      </Section>
      <Section title="App">
        <Card className="space-y-2"><InstallButton /></Card>
      </Section>
      <Section title="Meal photo AI">
        <AiKeyCard />
      </Section>
      <Section title="Profile">
        <Card className="space-y-3">
          <Field label="Your name (for the greeting)"><input className="field" value={settings.name} onChange={e => update({ name: e.target.value })} /></Field>
          <Field label="Timezone"><input className="field" value={settings.timezone} onChange={e => update({ timezone: e.target.value })} /></Field>
          <div className="text-xs text-ink-3">Kairo follows your phone's clock (currently {Intl.DateTimeFormat().resolvedOptions().timeZone}).</div>
          <Field label={`Mark as missed after (minutes past end): ${settings.overdueGraceMin}`}>
            <input type="range" min={0} max={60} step={5} value={settings.overdueGraceMin} onChange={e => update({ overdueGraceMin: Number(e.target.value) })} className="w-full accent-[#C9B8FF]" />
          </Field>
        </Card>
      </Section>
      <Section title="Notifications">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-lavender" />
            <div className="flex-1 text-sm font-semibold">Task starts & reminders</div>
            <Pill variant={settings.notifications ? 'lavender' : 'glass'} className="h-8 text-xs" onClick={async () => {
              if (settings.notifications) return update({ notifications: false })
              const ok = await requestPermission()
              update({ notifications: ok })
              setMsg(ok ? 'Notifications on.' : 'Permission was not granted.')
            }}>{settings.notifications ? 'On' : 'Off'}</Pill>
          </div>
          <p className="text-xs text-ink-3 leading-relaxed">
            {isNative() ? 'Android app: notifications are scheduled with the system and fire even when Kairo is closed.'
              : 'Browser/PWA: notifications fire only while Kairo is open or recently in the background. Browsers cannot act like native Android alarms when the app is fully closed — use the Android build for that.'}
          </p>
        </Card>
      </Section>
      <Section title="Motion">
        <Segmented value={settings.reducedMotion} onChange={v => update({ reducedMotion: v })} options={[{ v: 'system', l: 'Follow system' }, { v: 'off', l: 'Full motion' }, { v: 'on', l: 'Reduced' }]} />
      </Section>
      <Section title="Weekend days">
        <div className="flex gap-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => {
            const on = settings.weekendDays.includes(i)
            return <button key={i} onClick={() => update({ weekendDays: on ? settings.weekendDays.filter(x => x !== i) : [...settings.weekendDays, i] })}
              className={`flex-1 h-9 rounded-full text-xs font-bold ${on ? 'bg-lavender text-purple-deep' : 'glass text-ink-2'}`}>{d}</button>
          })}
        </div>
      </Section>
      <Section title="Trading instruments">
        <Card><Field label="Tracked (comma separated)">
          <input className="field" defaultValue={instruments.join(', ')} onBlur={e => useStore.setState({ trackedInstruments: e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean) })} />
        </Field></Card>
      </Section>
      <Section title="Backup & restore">
        <Card className="space-y-3">
          <p className="text-xs text-ink-3">Everything is stored privately on this device (IndexedDB). Export regularly — import restores a backup or migrates data from another device.</p>
          <div className="flex gap-2">
            <Pill className="flex-1" onClick={doExport}><Download size={16} /> Export JSON</Pill>
            <Pill className="flex-1" onClick={() => file.current?.click()}><Upload size={16} /> Import</Pill>
          </div>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return
            if (!window.confirm('Importing replaces the data currently on this device with the backup. Export first if unsure. Continue?')) return
            const r = importJSON(await f.text())
            setMsg(r.ok ? 'Backup restored.' : `Import failed: ${r.error}`)
            e.target.value = ''
          }} />
          {msg && <div className="text-xs text-lavender">{msg}</div>}
        </Card>
      </Section>
      <div className="text-center text-[11px] text-ink-3 pb-4">Kairo 1.0 · personal mission control · offline-first</div>
    </div>
  )
}
