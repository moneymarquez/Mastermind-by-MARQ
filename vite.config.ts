import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// https://vite.dev/config/
// Shown in Settings → What's new. Cloudflare Workers Builds exposes the
// commit as WORKERS_CI_COMMIT_SHA; local builds fall back to git.
function buildId(): string {
  const sha = process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'dev'; }
}

// The public marketing site: its own HTML pages, built beside the app but
// never part of it (no app CSS, not in the service worker's precache).
const SITE_PAGES = ['home', 'product', 'concepts', 'jobs', 'apply', 'team', 'refund', 'disclaimers', 'roadmap', 'sms', 'privacy', 'terms'];

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(buildId()) },
  build: {
    rollupOptions: {
      input: Object.fromEntries([['main', 'index.html'], ...SITE_PAGES.map((p) => [p, `${p}.html`])]),
    },
  },
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
      // Default precache limit is 2 MiB — the main bundle crossed that as
      // the app grew (Marketing/Content 101 reference docs, brief/growth-
      // plan forms). Raised with headroom rather than re-bumped every time
      // a build item adds a few hundred KB; doesn't change what's cached,
      // just how large a single precached file is allowed to be.
      injectManifest: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Keep the public site out of the app's offline cache.
        globIgnores: ['**/node_modules/**', ...SITE_PAGES.map((p) => `${p}.html`), 'site/**', 'assets/site-*', 'assets/home-*'],
      },
    }),
  ],
})
