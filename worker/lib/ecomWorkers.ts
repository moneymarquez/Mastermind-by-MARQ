// E-commerce phases 5–7 — the pure half of Supplier Finder, Brand Lab,
// Store Builder, Content Producer and Analytics: briefs, parsers, the
// store quality gate and the funnel diagnosis. No network; engine.ts runs
// them and tests/ecom-workers.test.ts checks each on its own.
import { extractJson } from './scout';
import { brief } from './workers';
import type { BriefCtx } from './workers';
import { blockedUrl } from './contentWorkers';

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
const strs = (v: unknown, n: number, max = 300): string[] => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

/** What every phase-5–7 worker knows about the brand: its step fields. */
export interface BrandCtx { id: string; name: string; product: string; sell_price: number | null; buyer: string; angle: string; principle: string; voice: string; positioning: string; palette: string; domain: string; supplier_cost: number | null; ship_days: number | null }
const brandLines = (b: BrandCtx) => [
  `Brand: ${b.name}. Product: ${b.product || 'not picked yet'}${b.sell_price != null ? ` at $${b.sell_price}` : ''}.`,
  b.buyer && `Buyer: ${b.buyer}`, b.angle && `Angle: ${b.angle}`, b.principle && `Principle: ${b.principle}`,
  b.positioning && `Positioning: ${b.positioning}`, b.voice && `Voice: ${b.voice}`, b.palette && `Palette: ${b.palette}`,
].filter(Boolean).join('\n');

// ── Supplier Finder (step 4) ──────────────────────────────────────────
export interface Evidence { fact: string; url: string | null }
export interface SupplierOpt {
  name: string; url: string | null; unit_cost: number | null; ship_cost: number | null; ship_days: number | null; rating: number | null; moq: number | null; branded_packaging: boolean | null; notes: string;
  /** What the listing actually sells, and whether that is the product (a hoodie is not a throw). */
  listing_title: string; same_product: boolean | null;
  landed: number | null; reviews: number | null; years: number | null; trade_assurance: boolean | null; ships_from: string;
  why: string; pros: string[]; risks: string[]; evidence: Evidence[];
}
export interface SupplierPayload { brand_id: string; product_id: string | null; sell_price?: number | null; product?: string; suppliers: SupplierOpt[]; pick: number; why_pick: string; why_not_others: string; sample: { qty: number; variant: string; est_cost: number | null; notes: string }; inspection: string[]; shot_list: string[]; summary: string; dropped: string[] }
export function supplierSystem(ctx: BriefCtx): string {
  return brief(
    'You are Supplier Finder for a solo founder launching a dropshipping brand on about $100. He decides from your research, so every claim needs a reason and a source.',
    [
      'Use web search to find 3–5 real suppliers whose listing is THE SAME product (same item type, size range and material). A wearable hoodie is not a throw blanket; a different item is not "close enough". Open each listing you cite. One URL you actually saw for each.',
      'For each supplier report: listing_title (what the listing says it sells), same_product (true/false), unit_cost, ship_cost and ship_days to the US, ships_from (country/warehouse), rating and number of reviews, MOQ, years on the platform, Trade Assurance (Alibaba) or buyer protection, branded packaging. Unknown = null, never a guess dressed as a number.',
      'landed = unit_cost + ship_cost to the US, and note duties if they matter.',
      'why: 2–3 sentences on why this supplier is or is not smart for HIS situation (tiny budget, testing first, needs fast US delivery for TikTok, wants to brand it later). pros and risks: 2–4 short, specific points each (e.g. "MOQ 300 = $1,440 upfront, too much for a test").',
      'evidence: 2–4 facts you found that back the why, each with the URL where you saw it (reviews mentioning pilling, response time, sold count, certificate, shipping complaints...). No fact without a URL you saw.',
      'pick = index of the best one for a first test (fast shipping and low MOQ beat the last dollar; only a same_product supplier can be picked). why_pick: why it beats the others. why_not_others: one line per other supplier on why not.',
      'Draft the sample order (quantity, variant, estimated cost) — the founder buys it himself. Write the inspection checklist (the hard-no list) and the product shot list to film from the sample.',
    ],
    ctx,
    '{"suppliers":[{"name":"","url":"","listing_title":"","same_product":true,"unit_cost":null,"ship_cost":null,"ship_days":null,"landed":null,"ships_from":"","rating":null,"reviews":null,"moq":null,"years":null,"trade_assurance":null,"branded_packaging":null,"why":"","pros":[""],"risks":[""],"evidence":[{"fact":"","url":""}],"notes":""}],"pick":0,"why_pick":"","why_not_others":"","sample":{"qty":2,"variant":"","est_cost":null,"notes":""},"inspection":[""],"shot_list":[""],"summary":"one sentence"}',
  );
}
export function supplierUser(b: BrandCtx, instructions?: string | null): string {
  return [brandLines(b), 'Use at most 8 searches: find candidates, then open each listing and look for reviews or complaints about the supplier.', instructions ? `Extra instructions for this run: ${instructions}` : ''].filter(Boolean).join('\n\n');
}
/** Landed cost per unit for ranking (unit + shipping), null if unknown. */
export const landedOf = (s: Pick<SupplierOpt, 'unit_cost' | 'ship_cost'>) => (s.unit_cost == null ? null : s.unit_cost + (s.ship_cost ?? 0));
const httpUrl = (v: unknown, blocked: string[]) => { const u = str(v, 600); return u && /^https?:\/\//i.test(u) && !blockedUrl(u, blocked) ? u : null; };
const bool = (v: unknown) => (typeof v === 'boolean' ? v : null);
export function parseSuppliers(text: string, b: BrandCtx, productId: string | null, blocked: string[]): SupplierPayload {
  const o = extractJson(text) as Record<string, unknown>;
  const dropped: string[] = [];
  const all: SupplierOpt[] = [];
  for (const raw of Array.isArray(o.suppliers) ? o.suppliers : []) {
    const r = raw as Record<string, unknown>;
    const name = str(r.name, 160);
    if (!name) continue;
    const url = httpUrl(r.url, blocked);
    if (!url && str(r.url)) dropped.push(`${name}: link dropped`);
    const rating = num(r.rating);
    const unit = num(r.unit_cost), ship = num(r.ship_cost);
    const ev = (Array.isArray(r.evidence) ? r.evidence : []).map((e) => e as Record<string, unknown>)
      .map((e) => ({ fact: str(e.fact, 300), url: httpUrl(e.url, blocked) })).filter((e) => e.fact && e.url).slice(0, 5);
    all.push({
      name, url, unit_cost: unit, ship_cost: ship, ship_days: num(r.ship_days), rating: rating != null && rating >= 0 && rating <= 5 ? rating : null,
      moq: num(r.moq), branded_packaging: bool(r.branded_packaging), notes: str(r.notes, 400),
      listing_title: str(r.listing_title, 200), same_product: bool(r.same_product),
      landed: num(r.landed) ?? landedOf({ unit_cost: unit, ship_cost: ship }), reviews: num(r.reviews), years: num(r.years), trade_assurance: bool(r.trade_assurance), ships_from: str(r.ships_from, 80),
      why: str(r.why, 700), pros: strs(r.pros, 4, 200), risks: strs(r.risks, 4, 200), evidence: ev,
    });
  }
  // A listing for a different item is not an option, however cheap.
  const suppliers = all.filter((x) => {
    if (x.same_product === false) { dropped.push(`${x.name}: listing is a different product (${x.listing_title || 'not the same item'})`); return false; }
    return true;
  });
  if (!suppliers.length) throw new Error('Supplier Finder found no supplier selling this exact product.');
  const p = num(o.pick);
  const pickedName = p != null && p >= 0 && p < all.length ? all[Math.round(p)].name : null;
  let pick = Math.max(0, suppliers.findIndex((x) => x.name === pickedName));
  if (pickedName == null || suppliers[pick]?.name !== pickedName) {
    // The model's pick was dropped: take the cheapest landed same-product one.
    const ranked = suppliers.map((x, i) => ({ i, l: x.landed ?? Infinity })).sort((a, z) => a.l - z.l);
    pick = ranked[0].i;
  }
  const s = (o.sample ?? {}) as Record<string, unknown>;
  const qty = num(s.qty);
  return {
    brand_id: b.id, product_id: productId, sell_price: b.sell_price, product: b.product, suppliers: suppliers.slice(0, 5), pick: Math.min(pick, 4), why_pick: str(o.why_pick, 800), why_not_others: str(o.why_not_others, 1200),
    sample: { qty: qty != null && qty > 0 ? Math.min(10, Math.round(qty)) : 2, variant: str(s.variant, 200), est_cost: num(s.est_cost), notes: str(s.notes, 400) },
    inspection: strs(o.inspection, 15), shot_list: strs(o.shot_list, 15), summary: str(o.summary, 400), dropped,
  };
}

// ── Brand Lab (step 5) ────────────────────────────────────────────────
export interface BrandOption { name: string; domain: string; handles: string; positioning: string; voice: string; palette: { hex: string; name: string; why: string }[]; type: { heading: string; body: string; why: string }; logo_direction: string; principle: string; why_this_buyer: string; domain_status?: 'available' | 'taken' | 'unknown' }
export function brandSystem(ctx: BriefCtx): string {
  return brief(
    'You are Brand Lab. From the buyer profile, write three complete, different brand options for one product.',
    [
      'Each: a name (short, sayable, not a dictionary word with a typo), the .com domain to check, IG/TikTok handles, positioning (who it is for and why they would pick it), voice in 3 words, a palette of 3–4 colours as hex with a reason per colour tied to this buyer, a heading + body typeface pairing (Google Fonts) with the reason, and a logo direction a designer could execute.',
      'Reason from the buyer — never generic. Each option takes a different positioning bet, and says which psychology principle it leans on.',
      'Never invent trademarks of existing big brands.',
    ],
    ctx,
    '{"options":[{"name":"","domain":"name.com","handles":"@name","positioning":"","voice":"","palette":[{"hex":"#000000","name":"","why":""}],"type":{"heading":"","body":"","why":""},"logo_direction":"","principle":"","why_this_buyer":""}],"summary":"one sentence"}',
  );
}
export function brandUser(b: BrandCtx, instructions?: string | null): string {
  return [brandLines(b), instructions ? `Extra instructions for this run: ${instructions}` : ''].filter(Boolean).join('\n\n');
}
const HEX = /^#[0-9a-f]{6}$/i;
/** A .com from whatever the model wrote ("Northline Goods" → northlinegoods.com). */
export function domainFor(name: string, given?: string): string {
  const g = (given ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (/^[a-z0-9-]{2,63}\.[a-z]{2,}$/.test(g)) return g;
  return `${name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '').slice(0, 50) || 'brand'}.com`;
}
export function parseBrands(text: string): { options: BrandOption[]; summary: string } {
  const o = extractJson(text) as { options?: unknown[]; summary?: unknown };
  const options: BrandOption[] = [];
  for (const raw of Array.isArray(o.options) ? o.options : []) {
    const r = raw as Record<string, unknown>;
    const name = str(r.name, 60);
    if (!name || options.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
    const t = (r.type ?? {}) as Record<string, unknown>;
    options.push({
      name, domain: domainFor(name, str(r.domain, 100)), handles: str(r.handles, 120) || `@${name.toLowerCase().replace(/[^a-z0-9._]/g, '')}`,
      positioning: str(r.positioning, 600), voice: str(r.voice, 80),
      palette: (Array.isArray(r.palette) ? r.palette : []).map((c) => { const x = c as Record<string, unknown>; return { hex: str(x.hex, 7), name: str(x.name, 40), why: str(x.why, 200) }; }).filter((c) => HEX.test(c.hex)).slice(0, 5),
      type: { heading: str(t.heading, 60), body: str(t.body, 60), why: str(t.why, 200) }, logo_direction: str(r.logo_direction, 400), principle: str(r.principle, 200), why_this_buyer: str(r.why_this_buyer, 500),
    });
  }
  if (options.length < 2) throw new Error('Brand Lab needs at least two distinct options.');
  return { options: options.slice(0, 3), summary: str(o.summary, 400) };
}
/** RDAP says 404 for an unregistered .com — that's the whole check. */
export function domainStatusFrom(httpStatus: number): 'available' | 'taken' | 'unknown' {
  return httpStatus === 404 ? 'available' : httpStatus === 200 ? 'taken' : 'unknown';
}

// ── Store Builder (step 6) ────────────────────────────────────────────
export function storeSystem(ctx: BriefCtx): string {
  return brief(
    'You are Store Builder. Write a one-product landing page for a new brand as ONE self-contained HTML file.',
    [
      'Mobile-first (375px), inline <style>, no external JS, fonts from Google Fonts only. Sections: hero with the angle as the headline and the price, the problem, how it works (3 steps), proof (what the buyer gets — no invented reviews or fake numbers), a short FAQ about the product itself, and a sticky "Buy" button linking to #checkout.',
      'This site is one of several that check out through ONE shared Shopify store whose refund, shipping and privacy policies apply to every site. NEVER state return windows, refund terms, guarantees, shipping times or costs, or free-shipping promises — the page footer links to the store\'s own policy pages (added at launch). If the FAQ touches shipping or returns, the answer is only "See our Shipping / Refund policy below." Don\'t write a footer, a contact address or policy pages; launch adds them.',
      'Use the brand\'s palette and type. Real copy in the brand voice — no lorem ipsum, no [brackets], no "Your Brand", no TODO.',
      'Doesn\'t-look-AI-made: no purple gradients unless the palette has them, no emoji bullets, no "Elevate your…", no "Unlock", no three identical cards with icons.',
      'Every <img> has alt text; use https://placehold.co/600x600?text=Product+photo only where a real product photo will go.',
    ],
    ctx,
    'Wrap the whole file in ```html … ``` and nothing else.',
  ).replace(/Answer with ONLY a JSON object, no prose: /, 'Answer format: ');
}
export function storeUser(b: BrandCtx, instructions?: string | null): string {
  return [brandLines(b), b.ship_days != null ? `Ships in about ${b.ship_days} days.` : '', instructions ? `Extra instructions for this run: ${instructions}` : ''].filter(Boolean).join('\n\n');
}
export function extractHtml(text: string): string {
  const m = text.match(/```html\s*([\s\S]*?)```/i);
  const html = (m ? m[1] : text).trim();
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) throw new Error('Store Builder did not return a complete HTML file.');
  return html;
}
export interface GateCheck { name: string; pass: boolean; detail: string }
/** The quality gate a preview has to pass before you even look at it. */
export function qualityGate(html: string): { pass: boolean; checks: GateCheck[] } {
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const noAlt = imgs.filter((t) => !/\balt\s*=\s*"[^"]+"/i.test(t)).length;
  const placeholder = html.match(/lorem ipsum|\[[A-Z][A-Za-z ]{2,30}\]|your brand|TODO|xxx/i);
  const aiTells = html.match(/elevate your|unlock (the|your)|seamless(ly)?|game[- ]changer|delve/i);
  const scripts = (html.match(/<script\b[^>]*src=/gi) ?? []).length;
  const kb = Math.round(new TextEncoder().encode(html).length / 1024);
  const checks: GateCheck[] = [
    { name: 'Mobile viewport', pass: /<meta[^>]+name=["']viewport["']/i.test(html), detail: 'meta viewport tag' },
    { name: 'Has a title', pass: /<title>[^<]{3,}<\/title>/i.test(html), detail: 'non-empty <title>' },
    { name: 'Buy button', pass: /href=["']#checkout["']/i.test(html), detail: 'a link to #checkout' },
    { name: 'No placeholder text', pass: !placeholder, detail: placeholder ? `found "${placeholder[0]}"` : 'none found' },
    { name: 'Doesn\'t read AI-made', pass: !aiTells, detail: aiTells ? `found "${aiTells[0]}"` : 'none of the tells' },
    { name: 'Images have alt text', pass: noAlt === 0, detail: imgs.length ? `${imgs.length - noAlt}/${imgs.length}` : 'no images' },
    { name: 'No external scripts', pass: scripts === 0, detail: `${scripts} found` },
    { name: 'Light page', pass: kb <= 150, detail: `${kb} KB` },
  ];
  return { pass: checks.every((c) => c.pass), checks };
}

// ── Analytics (steps 9–10) ────────────────────────────────────────────
export interface Funnel { views: number | null; clicks: number | null; add_to_carts: number | null; purchases: number | null; refunds?: number | null; orders30?: number; revenue30?: number }
export type Flag = 'kill' | 'double_down' | 'fix' | 'wait';
/** §9 of the e-comm spec: where the funnel breaks, as the step-9 option,
 *  and the flag it raises. Thresholds are the founder's own rules. */
export function diagnoseFunnel(f: Funnel): { diagnosis: string; flag: Flag; why: string } {
  const v = f.views ?? 0, c = f.clicks ?? 0, a = f.add_to_carts ?? 0, p = f.purchases ?? 0;
  if (v < 1000) return { diagnosis: 'not enough data', flag: 'wait', why: `${v.toLocaleString('en-US')} views — need 1,000+ before it means anything.` };
  if (v / 14 < 300 && c === 0) return { diagnosis: 'low views — hook', flag: 'fix', why: 'Views are low and nobody clicks — the hook isn\'t stopping the scroll.' };
  const ctr = c / v;
  if (ctr < 0.005) return { diagnosis: 'views, no clicks — not wanted', flag: p > 0 ? 'fix' : 'kill', why: `${(ctr * 100).toFixed(2)}% click-through on ${v.toLocaleString('en-US')} views — people see it and don't want it.` };
  if (c >= 50 && a / c < 0.04) return { diagnosis: 'clicks, no cart — page', flag: 'fix', why: `${(a / c * 100).toFixed(1)}% add-to-cart from ${c} clicks — the page loses them.` };
  if (a >= 10 && p / a < 0.25) return { diagnosis: 'cart, no purchase — price/trust', flag: 'fix', why: `${p} of ${a} carts bought — price, shipping time or trust at checkout.` };
  if (p >= 5 && (f.refunds ?? 0) / p > 0.15) return { diagnosis: 'sales, high refunds — product', flag: 'kill', why: `${f.refunds} refunds on ${p} sales — the product itself.` };
  if (p >= 5) return { diagnosis: 'working', flag: 'double_down', why: `${p} sales at ${(ctr * 100).toFixed(1)}% CTR — make more of what's working.` };
  return { diagnosis: 'not enough data', flag: 'wait', why: `${c} clicks, ${a} carts, ${p} sales — keep posting.` };
}
export function readSystem(ctx: BriefCtx): string {
  return brief(
    'You are the e-commerce Analytics worker. The funnel diagnosis below is computed from the numbers. Write the recommendation for the scale-or-kill decision.',
    ['recommendation: scale, iterate or kill. evidence: the numbers that decide it. next: the ONE thing to do this week. Under 60 words total.'],
    ctx,
    '{"recommendation":"scale|iterate|kill","evidence":"","next":""}',
  );
}
export function parseRead(text: string, flag: Flag): { recommendation: 'scale' | 'iterate' | 'kill'; evidence: string; next: string } {
  const fallback = flag === 'double_down' ? 'scale' : flag === 'kill' ? 'kill' : 'iterate';
  try {
    const o = extractJson(text) as Record<string, unknown>;
    const r = str(o.recommendation, 10).toLowerCase();
    return { recommendation: (['scale', 'iterate', 'kill'].includes(r) ? r : fallback) as 'scale' | 'iterate' | 'kill', evidence: str(o.evidence, 400), next: str(o.next, 300) };
  } catch { return { recommendation: fallback, evidence: '', next: '' }; }
}
