/** One marketing engine over any kind of brand (Addendum 2 §3). Pure: no React,
 *  no network. A brand is a product site, the app, Marq's own business, or a
 *  client; nothing here assumes a Shopify product, a store or a price. The
 *  E-commerce Marketing tab and the Made by Marq Marketing tab are two views
 *  of the same screen, filtered by brand type. */
import { IDEA_BANK } from './madeby';

export type BrandType = 'product' | 'app' | 'business' | 'client';
export type SuccessMetric = 'orders' | 'waitlist_signups' | 'leads' | 'client_results';

export const TYPE_LABEL: Record<BrandType, string> = { product: 'Product', app: 'App', business: 'Business', client: 'Client' };
/** Which brand types each tab shows. */
export const TAB_TYPES = { ecommerce: ['product'] as BrandType[], madeby: ['business', 'app', 'client'] as BrandType[] };
export const DEFAULT_METRIC: Record<BrandType, SuccessMetric> = { product: 'orders', app: 'waitlist_signups', business: 'leads', client: 'client_results' };
export const METRIC_LABEL: Record<SuccessMetric, string> = { orders: 'Orders from this brand\'s site', waitlist_signups: 'Waitlist signups', leads: 'New leads', client_results: 'Client results' };
/** Which spending bucket a brand's marketing draws from (HQ caps). */
export const BUDGET_BUCKET: Record<BrandType, 'ecommerce' | 'marketing'> = { product: 'ecommerce', app: 'marketing', business: 'marketing', client: 'marketing' };

export interface StoredBrand { key: string; name: string; brand_type: BrandType; ecom_brand_id: string | null; client_id: string | null; voice: string | null; audience: string | null; goal: string | null; success_metric: string | null; primary_url: string | null; active: boolean }
export interface MktBrand { key: string; name: string; type: BrandType; ecomBrandId: string | null; clientId: string | null; voice: string; audience: string; goal: string; metric: SuccessMetric; primaryUrl: string | null; stored: boolean }

export const brandKey = (type: BrandType, id: string) => `${type}:${id}`;
const METRICS = new Set<string>(['orders', 'waitlist_signups', 'leads', 'client_results']);
const metricOf = (v: string | null | undefined, t: BrandType): SuccessMetric => (v && METRICS.has(v) ? (v as SuccessMetric) : DEFAULT_METRIC[t]);

interface EcomBrandLite { id: string; name: string; owner_type?: string; positioning?: string | null; identity?: { voice?: string } | null; steps?: Record<string, { fields?: Record<string, string> }> | null }
interface ClientLite { id: string; business_name: string; stage?: string | null }

/** Stored brands, plus a derived brand for every e-com product and every active client that doesn't have a stored one yet. Pure. */
export function mergeBrands(stored: StoredBrand[], ecom: EcomBrandLite[], clients: ClientLite[], siteUrls: Record<string, string> = {}): MktBrand[] {
  const out: MktBrand[] = stored.filter((s) => s.active).map((s) => ({ key: s.key, name: s.name, type: s.brand_type, ecomBrandId: s.ecom_brand_id, clientId: s.client_id, voice: s.voice ?? '', audience: s.audience ?? '', goal: s.goal ?? '', metric: metricOf(s.success_metric, s.brand_type), primaryUrl: s.primary_url ?? (s.ecom_brand_id ? siteUrls[s.ecom_brand_id] ?? null : null), stored: true }));
  const have = new Set(stored.map((s) => s.key));
  for (const b of ecom) {
    const key = brandKey('product', b.id);
    if (have.has(key) || (b.owner_type && b.owner_type !== 'mine')) continue;
    out.push({ key, name: b.name, type: 'product', ecomBrandId: b.id, clientId: null, voice: b.identity?.voice ?? '', audience: b.steps?.['5']?.fields?.buyer ?? b.steps?.['3']?.fields?.buyer ?? '', goal: 'Make the first sales', metric: 'orders', primaryUrl: siteUrls[b.id] ?? null, stored: false });
  }
  for (const c of clients) {
    const key = brandKey('client', c.id);
    if (have.has(key) || !['active', 'retainer'].includes(c.stage ?? '')) continue;
    out.push({ key, name: c.business_name, type: 'client', ecomBrandId: null, clientId: c.id, voice: '', audience: '', goal: 'Grow the client\'s results', metric: 'client_results', primaryUrl: null, stored: false });
  }
  return out;
}
export const brandsForTypes = (brands: MktBrand[], types: BrandType[]) => brands.filter((b) => types.includes(b.type));

/** The brand's link with tracking tags, so posts can be traced to signups, orders or leads. Pure. */
export function trackedLink(brand: Pick<MktBrand, 'primaryUrl' | 'type' | 'key' | 'name'>, channel = 'social', handle?: string | null): string | null {
  if (!brand.primaryUrl) return null;
  try {
    const u = new URL(brand.primaryUrl);
    u.searchParams.set('utm_source', (handle ?? channel).replace(/^@/, '').toLowerCase().slice(0, 40) || 'social');
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', brand.type === 'app' ? 'waitlist' : brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || brand.type);
    return u.toString();
  } catch { return brand.primaryUrl; }
}

/** What the planner needs to know about a brand, as text. Works for every type. Pure. */
export function brandContext(b: MktBrand): string {
  return [
    `Brand: ${b.name} (${TYPE_LABEL[b.type].toLowerCase()})`,
    b.audience && `Audience: ${b.audience}`,
    b.voice && `Voice: ${b.voice}`,
    `Goal: ${b.goal || 'grow'}; success is measured by: ${METRIC_LABEL[b.metric]}`,
    b.primaryUrl && `Primary link: ${b.primaryUrl}`,
  ].filter(Boolean).join('\n');
}

const BUSINESS_IDEAS = [
  'Before and after: a local business site we rebuilt, with the numbers',
  'The 3 things every food truck page needs to get an order',
  'What a $1,500 site includes (and what it doesn\'t)',
  'Why your Google listing matters more than your Instagram',
  'A day of running three businesses from one screen',
  'Cold-call opener that actually got a meeting',
  'How we set up online ordering in a week',
  'Client win of the month: what changed and by how much',
];
const WAITLIST_IDEAS = [
  'I let an app reverse-engineer my goals for 30 days',
  'The weekly Money Move it gave me (and what I made)',
  'I talked to an AI for 10 minutes and it set up my entire life app (Brain Dump)',
  'Building a business while working a day job',
  'Founding spots: the first 100 lock $19.99/mo for life',
];
/** Starting ideas so the bank never opens blank. Pure. */
export function seedIdeas(b: Pick<MktBrand, 'type' | 'name' | 'audience'>): string[] {
  if (b.type === 'app') return [...new Set([...WAITLIST_IDEAS, ...IDEA_BANK])];
  if (b.type === 'business') return BUSINESS_IDEAS;
  if (b.type === 'product') return [`Show ${b.name} solving the problem in 10 seconds`, `The thing nobody tells you before buying ${b.name}`, `Unboxing ${b.name}: first impression, honest`, `${b.name} vs the thing you use now`, `3 ways people use ${b.name}`, `Customer-style demo: ${b.audience || 'the buyer'}'s day with ${b.name}`];
  return [`A result ${b.name} got this month, in one number`, `What ${b.name} does differently`, `Behind the scenes at ${b.name}`, `Customer question of the week, answered`];
}

export interface MetricData { orders30: number; revenue30: number; views30: number; waitlist30: number; waitlistTotal: number; leads30: number; clientDelta: string | null }
/** The one number this brand is judged on, with a short caption. Pure. */
export function successNumber(b: Pick<MktBrand, 'metric'>, d: MetricData): { label: string; value: string; caption: string } {
  switch (b.metric) {
    case 'orders': return { label: METRIC_LABEL.orders, value: String(d.orders30), caption: `$${Math.round(d.revenue30)} revenue · ${d.views30.toLocaleString('en-US')} site views · last 30 days` };
    case 'waitlist_signups': return { label: METRIC_LABEL.waitlist_signups, value: String(d.waitlist30), caption: `${d.waitlistTotal} on the list in total · last 30 days` };
    case 'leads': return { label: METRIC_LABEL.leads, value: String(d.leads30), caption: 'last 30 days' };
    default: return { label: METRIC_LABEL.client_results, value: d.clientDelta ?? '—', caption: 'baseline vs latest numbers from the client\'s Delivery tab' };
  }
}

/** Accounts that belong to a brand. Product → its own accounts; app → Masterminds; business → Made by Marq; client → the client's. Pure. */
export function accountsFor<A extends { owner: string; brand_id: string | null; client_id: string | null }>(b: Pick<MktBrand, 'type' | 'ecomBrandId' | 'clientId'>, accounts: A[]): A[] {
  switch (b.type) {
    case 'product': return accounts.filter((a) => b.ecomBrandId && a.brand_id === b.ecomBrandId);
    case 'app': return accounts.filter((a) => a.owner === 'mastermind');
    case 'business': return accounts.filter((a) => a.owner === 'madebymarq');
    default: return accounts.filter((a) => b.clientId && a.client_id === b.clientId);
  }
}
