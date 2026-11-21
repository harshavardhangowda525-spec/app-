import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-48.png'],
      manifest: {
        name: 'Kairo — Own every hour',
        short_name: 'Kairo',
        description: 'Personal mission control: schedule, focus, business, study and habits.',
        theme_color: '#0A0A12',
        background_color: '#0A0A12',
        id: '/',
        scope: '/',
        // Installed app opens edge-to-edge with no browser UI or status bar; falls back to standalone.
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        categories: ['productivity', 'lifestyle'],
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  build: { target: 'es2019', chunkSizeWarningLimit: 900 },
})
