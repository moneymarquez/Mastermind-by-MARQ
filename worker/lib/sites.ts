// Product sites (addendum §1–§6): every product/brand has its own website on
// Cloudflare Pages; all of them check out through the owner's ONE Shopify
// store. This file is the pure half — the checkout link, what gets added to
// each page (attribution script, shared-store footer), the launch gate, and
// reading attribution back off an order. All pure; tests cover it.
//
// Cart permalinks (shopify.dev "Create cart permalinks"):
//   https://{shop}.myshopify.com/cart/{variant_id}:{qty}[,{variant_id}:{qty}]
//   ?attributes[key]=value   → arrives on the order as note_attributes
//   &discount=CODE           → applies a discount code (comma = several codes)
//   &ref=…  &note=…          → also documented; not used here
// UTM tags are not a documented permalink parameter, so they ride along as
// cart attributes (attributes[utm_source]=…) and come back on the order.

export interface CheckoutSite { shop: string; slug: string; brand_id: string }
export interface Utm { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; utm_content?: string | null; discount?: string | null }
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

const cleanShop = (s: string) => (s ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim().toLowerCase();
/** gid://shopify/ProductVariant/123 → "123". */
export const variantNumber = (v: string | number) => String(v).split('/').pop()!.replace(/\D/g, '');

/** The Buy link for one site: variant, quantity, attribution, campaign. Pure. */
export function buildCheckoutUrl(site: CheckoutSite, variant: string | number, qty = 1, utm: Utm = {}): string {
  const shop = cleanShop(site.shop);
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error('Checkout needs the store\'s yourstore.myshopify.com domain.');
  const id = variantNumber(variant);
  if (!id) throw new Error('Checkout needs a Shopify variant ID.');
  const q = Math.max(1, Math.min(99, Math.floor(qty) || 1));
  const params: [string, string][] = [['attributes[mm_site]', site.slug], ['attributes[mm_brand]', site.brand_id]];
  for (const k of UTM_KEYS) { const v = utm[k]?.trim(); if (v) params.push([`attributes[${k}]`, v.slice(0, 100)]); }
  const code = utm.discount?.trim();
  if (code && !code.includes(',')) params.push(['discount', code.slice(0, 60)]);
  return `https://${shop}/cart/${id}:${q}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** Same rules as rewriteCheckout, plus a data-mm-buy marker the page script uses. Pure. */
export function pointBuyButtons(html: string, url: string): { html: string; count: number } {
  let count = 0;
  const safe = url.replace(/&/g, '&amp;').replace(/"/g, '%22');
  const out = html.replace(/href\s*=\s*(["'])#checkout\1/gi, () => { count++; return `href="${safe}" data-mm-buy="1"`; });
  return { html: out, count };
}

export interface SiteExtras { slug: string; beaconUrl: string; parentName: string; shop: string; supportEmail: string | null; variants?: { id: string; label: string }[] }
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The tiny inline script on every generated site: carries the visit's UTM
 *  tags and discount code into the Buy link, offers a variant picker when
 *  the product has more than one, and counts views and Buy clicks. Pure. */
export function siteScript(x: SiteExtras): string {
  const cfg = JSON.stringify({ s: x.slug, a: x.beaconUrl, v: (x.variants ?? []).filter((v) => variantNumber(v.id)).map((v) => ({ id: variantNumber(v.id), l: v.label.slice(0, 60) })) }).replace(/</g, '\\u003c');
  return `<script>(function(){var C=${cfg};var q=new URLSearchParams(location.search);function send(e){try{navigator.sendBeacon(C.a,JSON.stringify({site:C.s,event:e}))}catch(_){}}
var links=document.querySelectorAll('a[data-mm-buy]');function fix(a,vid){try{var u=new URL(a.href);if(vid){u.pathname=u.pathname.replace(/\\/cart\\/\\d+:/,'/cart/'+vid+':')}${UTM_KEYS.map((k) => `var ${k}=q.get('${k}');if(${k})u.searchParams.set('attributes[${k}]',${k}.slice(0,100));`).join('')}var d=q.get('discount');if(d&&d.indexOf(',')<0)u.searchParams.set('discount',d.slice(0,60));a.href=u.toString()}catch(_){}}
links.forEach(function(a){fix(a);a.addEventListener('click',function(){send('buy_click')})});
if(C.v.length>1&&links.length){var sel=document.createElement('select');sel.setAttribute('aria-label','Choose an option');sel.style.cssText='display:block;margin:0 auto 12px;padding:10px 12px;font:inherit;border-radius:10px;border:1px solid #ccc;background:#fff;color:#111';C.v.forEach(function(v){var o=document.createElement('option');o.value=v.id;o.textContent=v.l;sel.appendChild(o)});sel.addEventListener('change',function(){links.forEach(function(a){fix(a,sel.value)})});links[0].parentNode.insertBefore(sel,links[0])}
send('view')})();</script>`;
}

/** Footer every site shares: who runs checkout, the store's own policies
 *  (never the page's own promises), and the one support address. Pure. */
export function siteFooter(x: SiteExtras): string {
  const shop = cleanShop(x.shop);
  const pol = (path: string, label: string) => `<a href="https://${shop}/policies/${path}" style="color:inherit">${label}</a>`;
  const contact = x.supportEmail ? ` · <a href="mailto:${escHtml(x.supportEmail)}" style="color:inherit">Contact</a>` : '';
  return `<footer data-mm-footer style="padding:28px 16px;text-align:center;font:13px/1.6 -apple-system,Segoe UI,sans-serif;color:#777">Checkout securely powered by ${escHtml(x.parentName)}.<br>${pol('refund-policy', 'Refunds')} · ${pol('shipping-policy', 'Shipping')} · ${pol('privacy-policy', 'Privacy')} · ${pol('terms-of-service', 'Terms')}${contact}</footer>`;
}

/** Adds the footer and script just before </body> (or at the end). Pure. */
export function withSiteExtras(html: string, x: SiteExtras): string {
  const add = `${siteFooter(x)}${siteScript(x)}`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${add}</body>`) : html + add;
}

/** Launch gate after the Buy buttons are pointed (§3): at least one, and every
 *  one a cart permalink to the shared store's domain with mm_site set. Pure. */
export function checkoutGate(html: string, shop: string, slug: string): { pass: boolean; detail: string } {
  const host = cleanShop(shop);
  const hrefs = [...html.matchAll(/<a\b[^>]*data-mm-buy[^>]*>/gi)].map((m) => (m[0].match(/href="([^"]+)"/i)?.[1] ?? '').replace(/&amp;/g, '&'));
  if (!hrefs.length) return { pass: false, detail: 'No Buy button points at checkout.' };
  if (/href=["']#checkout["']/i.test(html)) return { pass: false, detail: 'A Buy button still points at #checkout.' };
  for (const h of hrefs) {
    let u: URL;
    try { u = new URL(h); } catch { return { pass: false, detail: `Not a valid link: ${h.slice(0, 80)}` }; }
    if (u.hostname !== host) return { pass: false, detail: `A Buy button goes to ${u.hostname}, not the store (${host}).` };
    if (!/^\/cart\/\d+:\d+/.test(u.pathname)) return { pass: false, detail: `Not a cart permalink: ${u.pathname}` };
    if (u.searchParams.get('attributes[mm_site]') !== slug) return { pass: false, detail: 'A Buy button is missing the mm_site attribution.' };
  }
  return { pass: true, detail: `${hrefs.length} Buy button${hrefs.length === 1 ? '' : 's'} → ${host} cart with mm_site=${slug}` };
}

// ── Attribution back off the order (§4) ─────────────────────────────────
export interface OrderAttributionInput { note_attributes?: { name?: string; value?: string }[] | null; landing_site?: string | null; referring_site?: string | null }
export interface SiteRef { id: string; slug: string; domain: string | null; deploy_url: string | null }
export interface Attribution { site_id: string | null; how: 'mm_site' | 'landing' | 'referrer' | 'none'; slug: string | null; utm: Record<string, string>; referrer: string | null }

const hostOf = (s: string | null | undefined) => { try { return s ? new URL(/^https?:/.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch { return ''; } };

/** Which site made this sale: the mm_site cart attribute first, then the
 *  landing URL, then the referring site's host. Pure. */
export function attributeOrder(o: OrderAttributionInput, sites: SiteRef[]): Attribution {
  const attrs = Object.fromEntries((o.note_attributes ?? []).filter((a) => a.name).map((a) => [String(a.name), String(a.value ?? '')]));
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) if (attrs[k]) utm[k] = attrs[k];
  const referrer = o.referring_site ?? null;
  const bySlug = (slug: string | null | undefined) => (slug ? sites.find((s) => s.slug === slug) : undefined);
  const hit = bySlug(attrs.mm_site);
  if (hit) return { site_id: hit.id, how: 'mm_site', slug: hit.slug, utm, referrer };
  let landingSlug: string | null = null;
  try { landingSlug = o.landing_site ? new URL(o.landing_site, 'https://x.invalid').searchParams.get('attributes[mm_site]') : null; } catch { landingSlug = null; }
  const land = bySlug(landingSlug);
  if (land) return { site_id: land.id, how: 'landing', slug: land.slug, utm, referrer };
  const ref = hostOf(referrer);
  const byHost = ref ? sites.find((s) => [hostOf(s.domain), hostOf(s.deploy_url)].includes(ref)) : undefined;
  if (byHost) return { site_id: byHost.id, how: 'referrer', slug: byHost.slug, utm, referrer };
  return { site_id: null, how: 'none', slug: null, utm, referrer };
}

/** A site slug that's safe as a Pages project name and not taken. Pure. */
export function siteSlug(brand: string, taken: string[] = []): string {
  const base = brand.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'site';
  if (!taken.includes(base)) return base;
  for (let i = 2; i < 100; i++) { const s = `${base}-${i}`; if (!taken.includes(s)) return s; }
  return `${base}-${Date.now().toString(36)}`;
}

// ── Don't sell what gets the one store banned (§6.4) ─────────────────────
// Categories from Shopify's Acceptable Use Policy and the Shopify Payments
// prohibited/restricted list (weapons, drugs, adult, tobacco/vape,
// regulated health claims, financial/gambling, counterfeit). Keyword-level:
// a hit means "don't pitch it", reviewed by a human if it's a false alarm.
const PROHIBITED: [RegExp, string][] = [
  [/\b(gun|firearm|ammo|ammunition|rifle|pistol|silencer|suppressor|switchblade|brass knuckles|taser|stun gun|pepper spray|crossbow|throwing star)\b/i, 'weapons'],
  [/\b(cbd|thc|kratom|delta[- ]?8|cannabis|marijuana|psilocybin|mushroom spores?|nitrous|whip ?its?|poppers|steroids?|sarms?|peptides?)\b/i, 'drugs, supplements or regulated substances'],
  [/\b(vape|e-?cig|e-?liquid|nicotine|tobacco|cigar|hookah)\b/i, 'tobacco or vaping'],
  [/\b(sex toy|adult toy|erotic|lingerie for adults|fetish|xxx)\b/i, 'adult content'],
  [/\b(weight[- ]loss pill|diet pill|fat burner|cures?|treats? (cancer|diabetes|covid)|miracle|fda[- ]approved)\b/i, 'medical or health claims'],
  [/\b(gambling|casino|lottery|crypto mining|get rich|forex signals?)\b/i, 'gambling or financial schemes'],
  [/\b(replica|knock-?off|dupe|inspired by|counterfeit|fake (designer|brand))\b/i, 'knockoffs or counterfeit'],
  [/\b(nike|adidas|apple|airpods|iphone|disney|marvel|pokemon|pokémon|nintendo|lego|stanley cup|yeti|gucci|louis vuitton|chanel|rolex|supreme)\b/i, 'someone else\'s trademark'],
];
/** Why a product can't go in the shared store, or null if it's fine. Pure. */
export function prohibitedReason(text: string): string | null {
  for (const [re, why] of PROHIBITED) { const m = text.match(re); if (m) return `${why} ("${m[0]}")`; }
  return null;
}
