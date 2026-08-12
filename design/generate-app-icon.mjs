// Regenerates public/icons/{icon-192,icon-512,apple-touch-icon}.png from
// design/marq-wordmark.png — the hand-drawn "MARQ" wordmark (white on
// black). The source image has a lot of black margin around the letters,
// so this finds the wordmark's real bounding box, crops to it with a
// small margin, and centers that on a black square — the letters end up
// noticeably bigger in the final icon than a naive full-image resize.
//
// One-off asset-generation script (matches design/generate-pwa-assets.mjs's
// reasoning for using Playwright over adding a sharp/ImageMagick dependency
// for something that only runs when the source art changes). Run with:
// node design/generate-app-icon.mjs [path/to/chromium]

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const executablePath = process.argv[2];
const sourcePath = path.join(here, 'marq-wordmark.png');
// Data URI instead of a file:// src — Image().src loaded from an
// about:blank page context can't decode file:// URLs (cross-origin), but
// a data: URI always works regardless of the page's own origin.
const sourceDataUri = `data:image/png;base64,${readFileSync(sourcePath).toString('base64')}`;

const OUT_SIZES = [
  { size: 192, out: 'icon-192.png' },
  { size: 512, out: 'icon-512.png' },
  { size: 180, out: 'apple-touch-icon.png' },
];

// How much breathing room to leave around the cropped wordmark, as a
// fraction of the crop's own size — smaller = bigger letters.
const MARGIN_FRACTION = 0.08;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();

const { bbox, srcW, srcH } = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);

  let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
  const THRESHOLD = 60; // near-black background vs. the white glyph
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness > THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { bbox: { minX, minY, maxX, maxY }, srcW: img.width, srcH: img.height };
}, sourceDataUri);

const glyphW = bbox.maxX - bbox.minX;
const glyphH = bbox.maxY - bbox.minY;
const glyphSize = Math.max(glyphW, glyphH);
const cropSize = Math.round(glyphSize * (1 + MARGIN_FRACTION * 2));
const cx = bbox.minX + glyphW / 2;
const cy = bbox.minY + glyphH / 2;
let cropX = Math.round(cx - cropSize / 2);
let cropY = Math.round(cy - cropSize / 2);
// Clamp so the crop stays inside the source image (falls back to letting
// the square touch the edge rather than reading out of bounds).
cropX = Math.max(0, Math.min(cropX, srcW - cropSize));
cropY = Math.max(0, Math.min(cropY, srcH - cropSize));

console.log(`glyph bbox: ${glyphW}x${glyphH} at (${bbox.minX},${bbox.minY}); crop: ${cropSize}x${cropSize} at (${cropX},${cropY})`);

for (const { size, out } of OUT_SIZES) {
  const iconPage = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await iconPage.setContent(`<html><body style="margin:0"><canvas id="c" width="${size}" height="${size}"></canvas></body></html>`);
  await iconPage.evaluate(
    async ({ src, cropX, cropY, cropSize, size }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, size, size);
    },
    { src: sourceDataUri, cropX, cropY, cropSize, size },
  );
  await iconPage.locator('#c').screenshot({ path: path.join(repoRoot, 'public', 'icons', out) });
  console.log('wrote public/icons/' + out);
  await iconPage.close();
}

await browser.close();
