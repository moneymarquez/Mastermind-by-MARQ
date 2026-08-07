import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // manifest.json is hand-written in public/ (exact content the app
    // spec called for) rather than generated here — this plugin is used
    // only for its real value: bundling sw-src/sw.ts with a correct,
    // build-hash-aware precache manifest (injectManifest), instead of
    // hand-rolling a service worker that lists filenames that change
    // every build and would go stale after a redeploy.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'sw-src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: false },
    }),
  ],
})
