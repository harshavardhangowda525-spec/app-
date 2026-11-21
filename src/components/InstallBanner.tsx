import { AnimatePresence, motion } from 'framer-motion'
import { Download, Share, X } from 'lucide-react'
import { useState } from 'react'
import { useInstall } from '../lib/install'
import { Pill, Sheet, spring } from './ui'

/** Install card on Today. Hidden once installed; snoozed for 3 days after "Not now". */
export function InstallBanner() {
  const { deferred, installed, dismissedAt, install, dismiss } = useInstall()
  const mode = useInstall(s => s.mode)()
  const [help, setHelp] = useState(false)
  const show = !installed && Date.now() - dismissedAt > 3 * 864e5
  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring}
            className="relative overflow-hidden rounded-[22px] p-3.5 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg,#2B1F4D,#1A1430)', border: '1px solid rgb(201 184 255 / .3)' }}>
            <img src="/icon-192.png" alt="" className="size-11 rounded-[12px] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Install Kairo</div>
              <div className="text-[11px] text-ink-2 leading-snug">Full-screen app on your home screen · works offline</div>
            </div>
            <Pill variant="lavender" className="h-9 px-3.5 text-xs shrink-0" onClick={async () => { if (deferred) await install(); else setHelp(true) }}>
              <Download size={14} /> Install
            </Pill>
            <button aria-label="Not now" onClick={dismiss} className="absolute top-1.5 right-1.5 p-1 text-ink-3"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <InstallHelp open={help} onClose={() => setHelp(false)} mode={mode} />
    </>
  )
}

export function InstallButton() {
  const { deferred, installed, install } = useInstall()
  const mode = useInstall(s => s.mode)()
  const [help, setHelp] = useState(false)
  if (installed) return <div className="text-xs text-success font-semibold">✓ Installed — running full screen</div>
  return (
    <>
      <Pill variant="lavender" className="w-full h-11" onClick={async () => { if (deferred) await install(); else setHelp(true) }}><Download size={16} /> Install Kairo app</Pill>
      <InstallHelp open={help} onClose={() => setHelp(false)} mode={mode} />
    </>
  )
}

function InstallHelp({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Install Kairo">
      <div className="space-y-3 text-sm text-ink-2 leading-relaxed">
        {mode === 'ios' ? (
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Tap <Share size={14} className="inline -mt-0.5" /> <b className="text-ink">Share</b> in Safari.</li>
            <li>Choose <b className="text-ink">Add to Home Screen</b>.</li>
          </ol>
        ) : (
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Open this page in <b className="text-ink">Chrome</b> on your phone.</li>
            <li>Tap the <b className="text-ink">⋮ menu</b> (top right).</li>
            <li>Tap <b className="text-ink">Install app</b> (or <b className="text-ink">Add to Home screen → Install</b>).</li>
          </ol>
        )}
        <p className="text-xs text-ink-3">Kairo then opens from its own icon, full screen with no browser bars, and works offline.</p>
      </div>
    </Sheet>
  )
}
