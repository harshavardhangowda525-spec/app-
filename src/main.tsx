import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { initInstall } from './lib/install'

initInstall()

if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
// autoUpdate: a new version installs and the app reloads itself. Check on open, on return to the app, and every 30 min,
// so an installed (full-screen) Kairo picks up new releases without reinstalling.
import { Capacitor } from '@capacitor/core'

if (!Capacitor.isNativePlatform()) registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
    setInterval(check, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
