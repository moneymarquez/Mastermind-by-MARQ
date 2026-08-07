// Regenerates public/icons/*.png and public/splash/*.png from
// design/icon.svg and design/splash-template.html.
//
// Requires Playwright (`npm install -D playwright` — not a runtime
// dependency of the app, so it's not in package.json; install it
// temporarily to run this, or use whatever Chromium/Playwright setup
// is available in your environment) and a Chromium executable. Run
// with: node design/generate-pwa-assets.mjs [path/to/chromium]
//
// Why Playwright instead of @vite-pwa/assets-generator: both are valid;
// this renders the real SVG/HTML at each exact target resolution instead
// of upscaling from one master image, and avoids adding a native
// image-processing (sharp) dependency chain for what's a one-time asset
// generation step, not something that runs on every build.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const executablePath = process.argv[2]; // optional override

const ICON_SIZES = [
  { size: 192, out: 'icon-192.png' },
  { size: 512, out: 'icon-512.png' },
  { size: 180, out: 'apple-touch-icon.png' },
];

const SPLASH_SIZES = [
  { w: 1170, h: 2532 },
  { w: 1179, h: 2556 },
  { w: 1284, h: 2778 },
  { w: 828, h: 1792 },
  { w: 750, h: 1334 },
];

const browser = await chromium.launch(executablePath ? { executablePath } : {});

// Icons: load the raw SVG, resize its width/height attrs per target size.
const iconPage = `file://${path.join(here, 'icon.svg')}`;
for (const { size, out } of ICON_SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.goto(iconPage);
  await page.evaluate((s) => {
    const svg = document.querySelector('svg');
    svg.setAttribute('width', String(s));
    svg.setAttribute('height', String(s));
  }, size);
  await page.screenshot({ path: path.join(repoRoot, 'public', 'icons', out) });
  console.log('wrote public/icons/' + out);
  await page.close();
}

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
