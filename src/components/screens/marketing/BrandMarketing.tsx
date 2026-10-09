import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import Thumbs from '../../mm/Thumbs';
import Progress from '../../mm/Progress';
import { field } from '../../mm/Page';
import { avgViews30 } from '../../../data/contentEngine';
import type { SocialAccount, SocialPost, PostMetrics } from '../../../data/contentEngine';
import { mergeBrands, brandsForTypes, brandContext, seedIdeas, successNumber, accountsFor, trackedLink, TYPE_LABEL, BUDGET_BUCKET, METRIC_LABEL } from '../../../data/mktBrands';
import type { BrandType, MktBrand, StoredBrand, MetricData } from '../../../data/mktBrands';

interface Idea { id: string; angle: string; account: string | null; status: string }
interface PlanRow { id: string; week_start: string; plan: { posts?: { day: string; account: string; hook: string; format: string; why: string }[]; paid_test?: { channel: string; amount_usd: number; why: string } | null; next_20?: string; focus?: string } }
const DEFAULT_CAP = 50;
const FORMATS = new Set(['reel', 'carousel', 'story']);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The Marketing view (Addendum 2 §3). One engine for every brand type; the
 *  E-commerce tab passes ['product'], the Made by Marq tab passes
 *  ['business', 'app', 'client']. Nothing here needs a Shopify product, a
 *  store or a price. `children` shows extra cards under the selected brand
 *  (the Made by Marq tab adds its funnel, offers and case studies). */
export default function BrandMarketing({ types, empty, children }: { types: BrandType[]; empty: string; children?: (brand: MktBrand) => ReactNode }) {
  const [brands, setBrands] = useState<MktBrand[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [accts, setAccts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [metrics, setMetrics] = useState<Record<string, PostMetrics[]>>({});
  const [data, setData] = useState<MetricData>({ orders30: 0, revenue30: 0, views30: 0, waitlist30: 0, waitlistTotal: 0, leads30: 0, clientDelta: null });
  const [spent, setSpent] = useState(0);
  const [cap, setCap] = useState(DEFAULT_CAP);
  const [hasSale, setHasSale] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [newIdea, setNewIdea] = useState('');
  const [edit, setEdit] = useState<{ voice: string; audience: string; goal: string; primaryUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadBrands = useCallback(async () => {
    const [s, e, c, st] = await Promise.all([
      supabase.from('mkt_brands').select('*'),
      supabase.from('ecom_brands').select('id,name,owner_type,positioning,identity,steps'),
      supabase.from('crm_clients').select('id,business_name,stage'),
      supabase.from('ecom_sites').select('brand_id,deploy_url,domain,domain_status'),
    ]);
    const urls: Record<string, string> = {};
    for (const x of (st.data ?? []) as { brand_id: string; deploy_url: string | null; domain: string | null; domain_status: string }[]) { const u = x.domain_status === 'active' && x.domain ? `https://${x.domain}` : x.deploy_url; if (u) urls[x.brand_id] = u; }
    const merged = brandsForTypes(mergeBrands((s.data ?? []) as StoredBrand[], (e.data ?? []) as never[], (c.data ?? []) as never[], urls), types);
    setBrands(merged);
    setSel((cur) => (cur && merged.some((b) => b.key === cur) ? cur : merged[0]?.key ?? null));
  }, [types]);
  useEffect(() => { void loadBrands(); }, [loadBrands]);
  const brand = brands.find((b) => b.key === sel) ?? null;

  const loadBrand = useCallback(async (b: MktBrand) => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
    const bucket = BUDGET_BUCKET[b.type];
    const [a, p, m, led, ctl, i, pl, sale] = await Promise.all([
      supabase.from('social_accounts').select('*'),
      supabase.from('social_posts').select('*').gte('posted_at', since).order('posted_at', { ascending: false }).limit(500),
      supabase.from('social_post_metrics').select('*').gte('captured_at', since).order('captured_at').limit(5000),
      supabase.from('biz_ledger').select('amount_usd,bucket,category').eq('kind', 'expense').gte('date', monthStart),
      supabase.from('system_controls').select('monthly_caps').maybeSingle(),
      supabase.from('mkt_brand_ideas').select('id,angle,account,status').eq('brand_key', b.key).order('created_at'),
      supabase.from('mkt_brand_plans').select('id,week_start,plan').eq('brand_key', b.key).order('week_start', { ascending: false }).limit(1),
      supabase.from('ecom_orders').select('id').not('brand_id', 'is', null).gt('total', 0).limit(1),
    ]);
    const mine = accountsFor(b, (a.data ?? []) as SocialAccount[]);
    setAccts(mine);
    const ids = new Set(mine.map((x) => x.id));
    setPosts(((p.data ?? []) as SocialPost[]).filter((x) => ids.has(x.account_id)));
    const mm: Record<string, PostMetrics[]> = {}; for (const r of (m.data ?? []) as PostMetrics[]) (mm[r.post_id] ??= []).push(r); setMetrics(mm);
    setSpent(((led.data ?? []) as { amount_usd: number; bucket: string | null; category: string }[]).filter((x) => x.bucket === bucket || (bucket === 'marketing' && x.category === 'marketing')).reduce((s, x) => s + Number(x.amount_usd), 0));
    const caps = ((ctl.data as { monthly_caps?: Record<string, number> } | null)?.monthly_caps ?? {}) as Record<string, number>;
    setCap(Number(caps[bucket] ?? DEFAULT_CAP));
    setHasSale(((sale.data ?? []) as unknown[]).length > 0);
    let id = (i.data ?? []) as Idea[];
    if (!i.error && !id.length) { const ins = await supabase.from('mkt_brand_ideas').insert(seedIdeas(b).map((angle) => ({ brand_key: b.key, angle, source: 'seed' }))).select('id,angle,account,status'); id = (ins.data ?? []) as Idea[]; }
    setIdeas(id.map((x) => ({ ...x, status: x.status ?? 'idea' })));
    setPlan(((pl.data ?? [])[0] as PlanRow) ?? null);

    // The one number this brand is judged on.
    const d: MetricData = { orders30: 0, revenue30: 0, views30: 0, waitlist30: 0, waitlistTotal: 0, leads30: 0, clientDelta: null };
    if (b.type === 'product' && b.ecomBrandId) {
      const sites = ((await supabase.from('ecom_sites').select('id').eq('brand_id', b.ecomBrandId)).data ?? []) as { id: string }[];
      const sid = sites.map((x) => x.id);
      if (sid.length) {
        const [o, v] = await Promise.all([supabase.from('ecom_orders').select('total').in('site_id', sid).gte('placed_at', since), supabase.from('ecom_site_daily').select('views').in('site_id', sid).gte('date', since.slice(0, 10))]);
        const orders = (o.data ?? []) as { total: number }[]; d.orders30 = orders.length; d.revenue30 = orders.reduce((s, x) => s + Number(x.total), 0);
        d.views30 = ((v.data ?? []) as { views: number }[]).reduce((s, x) => s + Number(x.views), 0);
      }
    } else if (b.type === 'app') {
      const [w30, wAll] = await Promise.all([supabase.from('waitlist').select('id', { count: 'exact', head: true }).gte('created_at', since), supabase.from('waitlist').select('id', { count: 'exact', head: true })]);
      d.waitlist30 = w30.count ?? 0; d.waitlistTotal = wAll.count ?? 0;
    } else if (b.type === 'business') {
      d.leads30 = (await supabase.from('mkt_inbound').select('id', { count: 'exact', head: true }).gte('created_at', since)).count ?? 0;
    } else if (b.clientId) {
      const rows = ((await supabase.from('client_metrics').select('kind,followers,monthly_revenue,leads_month,captured_at').eq('client_id', b.clientId).order('captured_at')).data ?? []) as { kind: string; followers: number | null; monthly_revenue: number | null; leads_month: number | null }[];
      const base = rows.find((r) => r.kind === 'baseline'), last = rows.at(-1);
      if (base && last && last !== base) { const pick = (r: typeof base) => r.monthly_revenue ?? r.leads_month ?? r.followers; const x = pick(base), y = pick(last); if (x != null && y != null && x > 0) d.clientDelta = `${y >= x ? '+' : ''}${Math.round(((y - x) / x) * 100)}%`; }
    }
    setData(d);
  }, []);
  useEffect(() => { if (brand) { setEdit(null); void loadBrand(brand); } }, [brand?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const num = useMemo(() => (brand ? successNumber(brand, data) : null), [brand, data]);
  const paidAllowed = brand?.type === 'product' ? hasSale : true;
  const budgetLeft = Math.max(0, cap - spent);

  const saveBrand = async () => {
    if (!brand || !edit) return;
    const row = { key: brand.key, name: brand.name, brand_type: brand.type, ecom_brand_id: brand.ecomBrandId, client_id: brand.clientId, voice: edit.voice || null, audience: edit.audience || null, goal: edit.goal || null, primary_url: edit.primaryUrl || null, success_metric: brand.metric, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('mkt_brands').upsert(row, { onConflict: 'user_id,key' });
    setMsg(error ? error.message : 'Saved.'); setEdit(null); await loadBrands();
  };
  const runPlan = async () => {
    if (!brand) return;
    setBusy(true); setMsg('');
    const r = await api<{ plan?: unknown; error?: string }>('/api/marketing/plan', { body: { facts: {
      brand_key: brand.key, brand: brandContext(brand), paidAllowed, budgetLeft,
      accounts: accts.map((x) => `@${x.handle} (${x.platform}): ${x.followers ?? '?'} followers, ~${avgViews30(posts.filter((p) => p.account_id === x.id), metrics) ?? '?'} avg views`),
      funnel: num ? `${num.value} — ${num.label} (${num.caption})` : 'unknown',
      nextTwenty: paidAllowed ? `$${spent.toFixed(2)} of $${cap} spent this month` : 'no paid promotion until the first real sale',
      ideas: ideas.filter((i) => i.status === 'idea').map((i) => i.angle),
    } } });
    setBusy(false); setMsg(r.error ?? 'New weekly plan ready.'); await loadBrand(brand);
  };
  const queueDrafts = async () => {
    if (!brand || !plan?.plan.posts?.length) return;
    const start = Date.parse(`${plan.week_start}T12:00:00Z`);
    const rows = plan.plan.posts.map((p) => {
      const acct = accts.find((a) => `@${a.handle}`.toLowerCase() === String(p.account).toLowerCase() || a.handle.toLowerCase() === String(p.account).replace(/^@/, '').toLowerCase());
      const di = Math.max(0, DAYS.indexOf(String(p.day).slice(0, 3)));
      return { account_id: acct?.id ?? null, brand_id: brand.ecomBrandId, status: 'idea', concept: `[${brand.name}] ${p.hook}`.slice(0, 300), hooks: [p.hook], format: FORMATS.has(p.format) ? p.format : 'reel', scheduled_for: new Date(start + di * 86400000).toISOString().slice(0, 10) };
    });
    const { error } = await supabase.from('content_items').insert(rows);
    setMsg(error ? error.message : `Queued ${rows.length} draft${rows.length === 1 ? '' : 's'} in Content. Nothing posts until you approve each one.`);
  };
  const addIdea = async () => { if (!brand || !newIdea.trim()) return; await supabase.from('mkt_brand_ideas').insert({ brand_key: brand.key, angle: newIdea.trim(), source: 'manual' }); setNewIdea(''); await loadBrand(brand); };
  const setIdea = async (id: string, status: string) => { setIdeas((x) => x.map((y) => (y.id === id ? { ...y, status } : y))); await supabase.from('mkt_brand_ideas').update({ status }).eq('id', id); };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setMsg('Copied.'); } catch { setMsg(t); } };

  if (!brands.length) return <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 16 }}>{empty}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {brands.map((b) => <button key={b.key} onClick={() => setSel(b.key)} className="mm-btn" style={{ height: 34, borderColor: b.key === sel ? 'var(--accent)' : undefined, fontWeight: b.key === sel ? 600 : 500 }}>{b.name} <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 4 }}>{TYPE_LABEL[b.type]}</span></button>)}
      </div>
      {msg && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{msg}</div>}
      {brand && num && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
          <Stat label={num.label} value={num.value} pill={num.caption} />
          <Stat label="Budget this month" value={`$${spent.toFixed(0)} / $${cap}`} pill={BUDGET_BUCKET[brand.type] === 'ecommerce' ? 'e-commerce bucket' : 'marketing bucket'} k={spent > cap * 0.8 ? 'warn' : 'neutral'} />
          <Stat label="Accounts" value={String(accts.length)} pill={accts.length ? accts.map((a) => `@${a.handle}`).join(' ').slice(0, 40) : 'add in Content → Accounts'} />
        </div>

        <Card title={brand.name} meta={`${TYPE_LABEL[brand.type]} brand · success = ${METRIC_LABEL[brand.metric].toLowerCase()}`} action={!edit ? <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => setEdit({ voice: brand.voice, audience: brand.audience, goal: brand.goal, primaryUrl: brand.primaryUrl ?? '' })}>Edit</button> : undefined}>
          {edit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([['audience', 'Audience'], ['voice', 'Voice and tone'], ['goal', 'Goal'], ['primaryUrl', 'Primary link']] as const).map(([k, l]) => <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>{l}<input style={field} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></label>)}
              <div style={{ display: 'flex', gap: 8 }}><button className="mm-btn mm-btn--primary" onClick={() => void saveBrand()}>Save</button><button className="mm-btn" onClick={() => setEdit(null)}>Cancel</button></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Audience:</span> {brand.audience || '—'}</div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Voice:</span> {brand.voice || '—'}</div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Goal:</span> {brand.goal || '—'}</div>
              {brand.primaryUrl && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Link:</span><code style={{ fontSize: 12.5, overflowWrap: 'anywhere', flex: '1 1 240px' }}>{trackedLink(brand)}</code>
                  <button className="mm-btn" style={{ height: 30, fontSize: 12.5 }} onClick={() => void copy(trackedLink(brand) ?? '')}>Copy tracked link</button>
                </div>
              )}
              {accts.length > 0 && brand.primaryUrl && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Per account: {accts.map((a) => <button key={a.id} className="mm-btn" style={{ height: 26, fontSize: 12, marginRight: 4 }} onClick={() => void copy(trackedLink(brand, a.platform, a.handle) ?? '')}>@{a.handle}</button>)}</div>}
              {!paidAllowed && <div style={{ fontSize: 13, color: 'var(--warning)' }}>Paid promotion is off for product brands until the first real sale. Organic only for now.</div>}
            </div>
          )}
        </Card>

        <Card title="This week's plan" meta={plan ? `week of ${plan.week_start}` : 'from the Marketing orchestrator'} action={<div style={{ display: 'flex', gap: 6 }}>{plan?.plan.posts?.length ? <button className="mm-btn" disabled={busy} onClick={() => void queueDrafts()}>Queue as drafts</button> : null}<button className="mm-btn mm-btn--primary" disabled={busy} onClick={() => void runPlan()}>{busy ? 'Planning… (30s)' : plan ? 'Plan again' : 'Plan this week'}</button></div>}>
          {!plan && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Picks hooks from the idea bank, which posts go on which account, and {paidAllowed ? 'at most one small paid test within the budget' : 'organic posts only (paid is off for now)'}. Drafts wait in Content for your approval; nothing posts by itself.</div>}
          {plan?.plan.focus && <div style={{ fontSize: 15, fontWeight: 600 }}>{plan.plan.focus}</div>}
          {(plan?.plan.posts ?? []).map((p, i) => <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><Chip k="neutral">{p.day}</Chip><span style={{ flex: 1 }}><strong>{p.account}</strong> · {p.hook}<span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-tertiary)' }}>{p.format} · {p.why}</span></span><Thumbs entityType="mkt_plan_post" entityId={`${plan?.id}-${i}`} domain="marketing" compact /></div>)}
          {plan?.plan.paid_test && <div style={{ fontSize: 14 }}>Paid test: ${plan.plan.paid_test.amount_usd} on {plan.plan.paid_test.channel} — {plan.plan.paid_test.why} <Thumbs entityType="mkt_plan_test" entityId={plan.id} domain="marketing" compact /></div>}
          {plan?.plan.next_20 && <div style={{ fontSize: 14 }}>💡 {plan.plan.next_20}</div>}
        </Card>

        <Card title="Budget" meta={`$${spent.toFixed(2)} of $${cap} this month · ${BUDGET_BUCKET[brand.type] === 'ecommerce' ? 'shared by every product brand' : 'marketing bucket'}`}>
          <Progress pct={cap ? (spent / cap) * 100 : 0} tone={spent > cap * 0.8 ? 'warn' : undefined} label="Budget used" />
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Spend comes from Ledger expenses in this bucket. The guardrail asks before anything over your per-action limit, flags amber at 80% and blocks at the cap. Change the caps in HQ.</div>
        </Card>

        <Card title="Idea bank" meta={`${ideas.filter((i) => i.status === 'idea').length} angles waiting`}>
          <div style={{ display: 'flex', gap: 8 }}><input style={{ ...field, flex: 1 }} placeholder="New angle" value={newIdea} onChange={(e) => setNewIdea(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addIdea(); }} /></div>
          {ideas.filter((i) => i.status !== 'dropped').map((i, k) => <div key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: k ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1, color: i.status === 'idea' ? 'var(--text)' : 'var(--text-tertiary)' }}>{i.angle}</span>{i.status === 'idea' ? <><button className="mm-btn" style={{ height: 28, fontSize: 12.5 }} onClick={() => void setIdea(i.id, 'planned')}>Use</button><button className="mm-btn" style={{ height: 28, fontSize: 12.5 }} onClick={() => void setIdea(i.id, 'dropped')}>Drop</button></> : <Chip k="neutral">{i.status}</Chip>}</div>)}
        </Card>
        {children?.(brand)}
      </>)}
    </div>
  );
}
