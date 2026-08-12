import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages serves this repo from https://<user>.github.io/room-inventory/.
 * `base`, the router basename, and the manifest start_url/scope all have to
 * agree on this string or the app installs to the wrong scope and 404s.
 */
const BASE = '/room-inventory/'

/**
 * Pages has no rewrite support, so a refresh on /room-inventory/c/T2 asks the
 * server for a file that does not exist. Serving index.html as 404.html hands
 * the SPA router the URL instead.
 */
function spaFallback404(): Plugin {
  return {
    name: 'room-inventory:404-fallback',
    apply: 'build',
    closeBundle() {
      const index = resolve(__dirname, 'dist/index.html')
      if (existsSync(index)) copyFileSync(index, resolve(__dirname, 'dist/404.html'))
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const dataMode = env.VITE_DATA_MODE || 'firebase'

  // Safety rail from BUILD-ORDER.md. `local` mode has no access control at all:
  // it reads and writes localStorage and stubs auth as signed in. If a local
  // build ever reached GitHub Pages the entire security model would be gone, so
  // fail the build rather than warn about it.
  if (command === 'build' && dataMode === 'local') {
    throw new Error(
      [
        '',
        'Refusing to build with VITE_DATA_MODE=local.',
        '',
        'Local mode stubs out authentication and keeps data in localStorage.',
        'A production bundle built this way has no access control whatsoever,',
        'so anyone who loads the deployed URL gets a working app.',
        '',
        'Use `npm run dev:local` for local mode, and build with',
        'VITE_DATA_MODE=firebase (the default).',
        '',
      ].join('\n'),
    )
  }

  return {
    base: BASE,
    plugins: [
      react(),
      tailwindcss(),
      spaFallback404(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/apple-touch-icon-180.png'],
        manifest: {
          name: 'Room Inventory',
          short_name: 'Inventory',
          description: 'What I own and which box it is in.',
          // Must match `base` above or iOS installs the app to the wrong scope.
          start_url: BASE,
          scope: BASE,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F6F7F5',
          theme_color: '#F6F7F5',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // The app shell is small enough to precache whole, so a cold start
          // from the Home Screen paints without touching the network.
          globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
          navigateFallback: `${BASE}index.html`,
          runtimeCaching: [
            {
              // Network-first for Firestore reads: fresh when online, last
              // known answer when the network is not there.
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'firestore',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Auth must never be served from cache.
              urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\/.*/,
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})
