// Bug inventory B-09: documents (invoices, agreements, reports) had no
// PDF. This prints one element through a hidden iframe so nothing of the
// app shell comes along: the browser's print sheet then offers "Save as
// PDF" (desktop) or, on iPhone, Share → Save to Files. The element's own
// inline styles travel with it; the few design tokens it uses (font
// sizes) are resolved from the app and written into the frame.

/** The CSS custom properties an HTML snippet refers to, resolved now. */
export function tokenBlock(html: string, resolve: (name: string) => string): string {
  const names = [...new Set(html.match(/var\(--[a-z0-9-]+/gi)?.map((m) => m.slice(4)) ?? [])];
  return `:root{${names.map((n) => `${n}:${resolve(n).trim() || 'initial'}`).join(';')}}`;
}

/** Safe file-ish title from a document name ("Invoice — Taco Stand"). */
export function printTitle(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' — ').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120) || 'Document';
}

export function printElement(el: HTMLElement, title: string): void {
  const html = el.outerHTML;
  const rootStyle = getComputedStyle(document.documentElement);
  const font = getComputedStyle(document.body).fontFamily;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>${tokenBlock(html, (n) => rootStyle.getPropertyValue(n))}
    @page { margin: 12mm; } html, body { margin: 0; background: #fff; font-family: ${font}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body > * { max-width: none !important; padding: 0 !important; } tr, li { break-inside: avoid; }</style></head><body>${html}</body></html>`);
  doc.close();
  const win = frame.contentWindow!;
  const done = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', done);
  // Let fonts/images settle, then print. Some mobile browsers never fire
  // afterprint; the frame is removed after a minute regardless.
  setTimeout(() => { win.focus(); win.print(); setTimeout(() => frame.remove(), 60_000); }, 250);
}
