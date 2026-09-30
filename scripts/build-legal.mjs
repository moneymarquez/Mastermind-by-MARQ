#!/usr/bin/env node
// Builds the public legal pages, public/privacy.html and public/terms.html,
// from the exact text in legal-src/*.txt. The pages are plain static HTML
// (not the React app) so they load with no login and no JavaScript, and
// carrier, Meta and App Store reviewers get the real <title> and text on
// the first request. The Worker's asset handling serves them at /privacy
// and /terms.
//
//   node scripts/build-legal.mjs
//
// Wording lives in legal-src/. Edit it there, re-run, commit. This script
// only adds structure (headings, lists, bold lead-ins) and never changes
// words.
import { readFileSync, writeFileSync } from 'node:fs';

const CONTACT_EMAIL = 'madebymarquez@icloud.com';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s).split(esc(CONTACT_EMAIL)).join(`<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`)
  .replace(/See our Privacy Policy\./, 'See our <a href="/privacy">Privacy Policy</a>.');

function body(text) {
  const blocks = text.replace(/\[CONTACT EMAIL\]/g, CONTACT_EMAIL).trim().split(/\n\s*\n/);
  const out = [];
  for (const [i, block] of blocks.entries()) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    if (i === 0 && /^Last updated:/.test(lines[0])) { out.push(`<p class="updated">${inline(lines[0])}</p>`); continue; }
    let rest = lines;
    // A short first line with more lines under it is a section heading.
    if (lines.length > 1 && !lines[0].startsWith('- ') && lines[0].length <= 40) {
      out.push(`<h2>${inline(lines[0])}</h2>`);
      rest = lines.slice(1);
    }
    const bullets = rest.filter((l) => l.startsWith('- '));
    const paras = rest.filter((l) => !l.startsWith('- ') && l.trim());
    for (const p of paras) {
      // "Subscriptions. Paid plans renew…" → bold lead-in, same words.
      const m = p.match(/^([A-Z][^.()"]{2,40}\.)\s(.+)$/);
      out.push(m ? `<p><strong>${inline(m[1])}</strong> ${inline(m[2])}</p>` : `<p>${inline(p)}</p>`);
    }
    if (bullets.length) out.push(`<ul>\n${bullets.map((b) => `  <li>${inline(b.slice(2))}</li>`).join('\n')}\n</ul>`);
  }
  return out.join('\n');
}

function page(title, path, text) {
  const other = path === '/privacy' ? ['/terms', 'Terms &amp; Conditions'] : ['/privacy', 'Privacy Policy'];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(title)} for Mastermind by MARQ." />
<link rel="canonical" href="https://mastermindsbymarq.com${path}" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
<meta name="theme-color" content="#faf9f7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0b0c11" media="(prefers-color-scheme: dark)" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
<style>
  /* Mastermind's landing-page tokens (src/index.css, light + dark). */
  :root { --bg: #faf9f7; --panel: #ffffff; --text: #15161b; --dim: #4a4d57; --faint: #7a7d87; --line: #e6e3de; --accent: #5d5294; --logo-filter: invert(1); --logo-blend: multiply; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b0c11; --panel: #12141b; --text: #f2f2f6; --dim: #b6b8c2; --faint: #8a8d98; --line: #23262f; --accent: #9184d9; --logo-filter: none; --logo-blend: screen; } }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
  a { color: var(--accent); text-underline-offset: 3px; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 0 20px; }
  header { border-bottom: 1px solid var(--line); }
  header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; padding-top: env(safe-area-inset-top); }
  .brand { display: flex; align-items: center; gap: 8px; color: var(--text); text-decoration: none; min-height: 44px; }
  .brand img { height: 30px; width: auto; filter: var(--logo-filter); mix-blend-mode: var(--logo-blend); }
  .brand b { display: block; font-weight: 600; font-size: 14px; letter-spacing: -0.02em; line-height: 1.05; }
  .brand small { display: block; font-size: 8px; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; color: var(--faint); }
  .back { font-size: 14px; color: var(--dim); text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
  main { padding: 36px 0 48px; }
  h1 { font-size: clamp(30px, 8vw, 42px); line-height: 1.1; letter-spacing: -0.03em; font-weight: 700; margin: 0 0 8px; }
  .updated { color: var(--faint); font-size: 14px; margin: 0 0 28px; }
  h2 { font-size: 19px; letter-spacing: -0.015em; font-weight: 650; margin: 32px 0 8px; }
  p { margin: 0 0 14px; color: var(--dim); }
  p strong { color: var(--text); font-weight: 650; }
  ul { margin: 0 0 14px; padding-left: 22px; color: var(--dim); }
  li { margin: 0 0 8px; }
  footer { border-top: 1px solid var(--line); }
  footer .wrap { display: flex; flex-wrap: wrap; gap: 8px 22px; align-items: center; min-height: 72px; padding-bottom: env(safe-area-inset-bottom); font-size: 13.5px; color: var(--faint); }
  footer a { color: var(--dim); text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
  footer .copy { margin-left: auto; }
</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="/"><img src="/marq-wordmark.png" alt="" width="30" height="30" /><span><b>Masterminds</b><small>by marq</small></span></a>
  <a class="back" href="/">Back to the app</a>
</div></header>
<main class="wrap">
<h1>${esc(title)}</h1>
${body(text)}
</main>
<footer><div class="wrap">
  <a href="/">Home</a>
  <a href="${other[0]}">${other[1]}</a>
  <a href="mailto:${CONTACT_EMAIL}">Contact</a>
  <span class="copy">© 2026 MARQ</span>
</div></footer>
</body>
</html>
`;
}

writeFileSync('public/privacy.html', page('Privacy Policy', '/privacy', readFileSync('legal-src/privacy.txt', 'utf8')));
writeFileSync('public/terms.html', page('Terms & Conditions', '/terms', readFileSync('legal-src/terms.txt', 'utf8')));
console.log('wrote public/privacy.html, public/terms.html');
