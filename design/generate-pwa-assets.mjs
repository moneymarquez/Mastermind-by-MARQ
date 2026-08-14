// Regenerates public/splash/*.png from design/splash-template.html.
//
// App icons (public/icons/*.png + the favicon) are NOT generated here —
// that used to render design/icon.svg (a plain-text "M" mark), but the
// icon actually shipped is the hand-drawn "MARQ" wordmark, generated from
// design/marq-wordmark.png by design/generate-icon.py. icon.svg is stale
// leftover from an earlier design iteration; don't use it as a source of
// truth for icons.
//
// Requires Playwright (`npm install -D playwright` — not a runtime
// dependency of the app, so it's not in package.json; install it
// temporarily to run this, or use whatever Chromium/Playwright setup
// is available in your environment) and a Chromium executable. Run
// with: node design/generate-pwa-assets.mjs [path/to/chromium]

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const executablePath = process.argv[2]; // optional override

const SPLASH_SIZES = [
  { w: 1170, h: 2532 },
  { w: 1179, h: 2556 },
  { w: 1284, h: 2778 },
  { w: 828, h: 1792 },
  { w: 750, h: 1334 },
];

const browser = await chromium.launch(executablePath ? { executablePath } : {});

// Splash screens: the HTML template uses vw-relative sizing, so it scales
// proportionally just from the viewport dimensions matching each target.
const splashPage = `file://${path.join(here, 'splash-template.html')}`;
for (const { w, h } of SPLASH_SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(splashPage);
  const out = `splash-${w}x${h}.png`;
  await page.screenshot({ path: path.join(repoRoot, 'public', 'splash', out) });
  console.log('wrote public/splash/' + out);
  await page.close();
}

await browser.close();
