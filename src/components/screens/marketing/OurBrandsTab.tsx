import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import Thumbs from '../../mm/Thumbs';
import { field } from '../../mm/Page';
import Progress from '../../mm/Progress';
import { avgViews30, followerChange30 } from '../../../data/contentEngine';
import type { SocialAccount, SocialPost, PostMetrics, AccountSnapshot } from '../../../data/contentEngine';
import { funnel, channelCosts, nextTwenty, OFFER_DEFAULTS, spotsLeft, IDEA_BANK } from '../../../data/madeby';
import type { ChannelSpend } from '../../../data/madeby';

const OWN = new Set(['mastermind', 'madebymarq', 'personal']);
const MONTHLY_BUDGET = 100;
type Offer = { key: 'founding' | 'annual' | 'guarantee'; enabled: boolean; config: Record<string, unknown>; claimed: number };

/** Marketing → Our Brands (brief §5.9): every account Marq owns, the real
 *  funnel, the launch offer builder, the $100 budget, the idea bank and
 *  the orchestrator's weekly plan, with 👍/👎 on its recommendations. */
export default function OurBrandsTab() {
  const [accts, setAccts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [metrics, setMetrics] = useState<Record<string, PostMetrics[]>>({});
  const [snaps, setSnaps] = useState<Record<string, AccountSnapshot[]>>({});
  const [inbound, setInbound] = useState<{ source: string | null; source_detail: string | null; created_at: string }[]>([]);
  const [visits, setVisits] = useState<number | null>(null);
  const [subs, setSubs] = useState<{ trials: number; paid: number; churned: number } | null>(null);
  const [spend, setSpend] = useState<{ category: string; party: string | null; amount_usd: number; date: string; bucket: string | null }[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [ideas, setIdeas] = useState<{ id: string; angle: string; account: string | null; status: string }[]>([]);
  const [plan, setPlan] = useState<{ id: string; week_start: string; plan: { posts?: { day: string; account: string; hook: string; format: string; why: string }[]; paid_test?: { channel: string; amount_usd: number; why: string } | null; next_20?: string; focus?: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const monthStart = new Date().toISOString().slice(0, 7) + '-01';
    const [a, p, m, sn, ib, l, o, i, pl] = await Promise.all([
      supabase.from('social_accounts').select('*'),
      supabase.from('social_posts').select('*').gte('posted_at', since).order('posted_at', { ascending: false }).limit(500),
      supabase.from('social_post_metrics').select('*').gte('captured_at', since).order('captured_at').limit(5000),
      supabase.from('social_account_snapshots').select('*').order('captured_at').limit(3000),
      supabase.from('mkt_inbound').select('source,source_detail,created_at').gte('created_at', since).limit(1000),
      supabase.from('biz_ledger').select('category,party,amount_usd,date,bucket').eq('kind', 'expense').gte('date', monthStart),
      supabase.from('launch_offers').select('key,enabled,config,claimed'),
      supabase.from('mkt_ideas').select('id,angle,account,status').order('created_at'),
      supabase.from('mkt_weekly_plans').select('id,week_start,plan').order('week_start', { ascending: false }).limit(1),
    ]);
    const own = ((a.data ?? []) as SocialAccount[]).filter((x) => OWN.has(x.owner));
    setAccts(own);
    const ids = new Set(own.map((x) => x.id));
    setPosts(((p.data ?? []) as SocialPost[]).filter((x) => ids.has(x.account_id)));
    const mm: Record<string, PostMetrics[]> = {}; for (const r of (m.data ?? []) as PostMetrics[]) (mm[r.post_id] ??= []).push(r); setMetrics(mm);
    const ss: Record<string, AccountSnapshot[]> = {}; for (const r of (sn.data ?? []) as AccountSnapshot[]) (ss[r.account_id] ??= []).push(r); setSnaps(ss);
    setInbound((ib.data ?? []) as typeof inbound);
    setSpend(((l.data ?? []) as typeof spend).filter((x) => x.category === 'marketing' || x.bucket === 'marketing'));
    setOffers((o.data ?? []) as Offer[]);
    let id = (i.data ?? []) as typeof ideas;
    if (!i.error && !id.length) { const ins = await supabase.from('mkt_ideas').insert(IDEA_BANK.map((angle) => ({ angle, source: 'seed' }))).select('id,angle,account,status'); id = (ins.data ?? []) as typeof ideas; }
    setIdeas(id);
    setPlan(((pl.data ?? [])[0] as typeof plan) ?? null);
    void api<{ daily?: { visits: number }[]; total?: number; error?: string }>('/api/marketing/visits?venture=masterminds').then((r) => setVisits(r.error ? null : r.total ?? (r.daily ?? []).reduce((s, d) => s + Number(d.visits ?? 0), 0)));
    void api<{ trials: number; paid: number; churned: number; error?: string }>('/api/marketing/funnel', { method: 'POST', body: {} }).then((r) => setSubs(r.error ? null : r));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const f = useMemo(() => funnel([{ key: 'visits', label: 'Site visitors', count: visits ?? 0 }, { key: 'trials', label: 'Trial starts', count: subs?.trials ?? 0 }, { key: 'paid', label: 'Paid', count: subs?.paid ?? 0 }, { key: 'churned', label: 'Churned', count: subs?.churned ?? 0 }]), [visits, subs]);
  const channels: ChannelSpend[] = useMemo(() => {
    const by = new Map<string, ChannelSpend>();
    for (const s of spend) { const ch = (s.party || 'other').toLowerCase(); const r = by.get(ch) ?? { channel: ch, spend: 0, trials: 0, paid: 0 }; r.spend += Number(s.amount_usd); by.set(ch, r); }
    for (const l of inbound) { const ch = (l.source || 'other').toLowerCase(); const r = by.get(ch) ?? { channel: ch, spend: 0, trials: 0, paid: 0 }; r.trials += 1; by.set(ch, r); }
    return [...by.values()];
  }, [spend, inbound]);
  const spent = spend.reduce((s, x) => s + Number(x.amount_usd), 0);
  const tip = nextTwenty(channels.filter((c) => c.spend > 0));

  const saveOffer = async (key: Offer['key'], patch: Partial<Offer>) => {
    const cur = offers.find((o) => o.key === key) ?? { key, enabled: false, config: { ...OFFER_DEFAULTS[key] }, claimed: 0 };
    const next = { ...cur, ...patch, config: { ...cur.config, ...(patch.config ?? {}) } };
    setOffers((xs) => [...xs.filter((x) => x.key !== key), next]);
    const { error } = await supabase.from('launch_offers').upsert({ key, enabled: next.enabled, config: next.config, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
    setMsg(error ? error.message : 'Saved. The site reads this.');
  };
  const runPlan = async () => {
    setBusy(true); setMsg('');
    const r = await api<{ plan?: unknown; error?: string }>('/api/marketing/plan', { body: { facts: { accounts: accts.map((x) => `@${x.handle} (${x.platform}, ${x.owner}): ${x.followers ?? '?'} followers, ~${avgViews30(posts.filter((p) => p.account_id === x.id), metrics) ?? '?'} avg views`), funnel: f.steps.map((s) => `${s.label} ${s.count}${s.conv != null ? ` (${s.conv}%)` : ''}`).join(' → '), budgetLeft: Math.max(0, MONTHLY_BUDGET - spent), nextTwenty: tip, ideas: ideas.filter((i) => i.status === 'idea').map((i) => i.angle) } } });
    setBusy(false); setMsg(r.error ?? 'New weekly plan ready.'); await load();
  };
  const addIdea = async () => { if (!newIdea.trim()) return; await supabase.from('mkt_ideas').insert({ angle: newIdea.trim(), source: 'manual' }); setNewIdea(''); await load(); };
  const setIdea = async (id: string, status: string) => { setIdeas((x) => x.map((y) => (y.id === id ? { ...y, status } : y))); await supabase.from('mkt_ideas').update({ status }).eq('id', id); };
  const signups = (handle: string) => inbound.filter((l) => `${l.source_detail ?? ''}`.toLowerCase().includes(handle.toLowerCase())).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      {msg && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{msg}</div>}
      <Card title="Every account you own" meta="Masterminds, Made by Marq and you">
        {accts.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Add them in Content → Accounts ("Add Masterminds, Made by Marq + personal accounts"). Numbers fill in once they're connected or logged.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
          {accts.map((a) => {
            const mine = posts.filter((p) => p.account_id === a.id);
            const ch = followerChange30(a, snaps[a.id] ?? []);
            const avg = avgViews30(mine, metrics);
            const views7 = mine.filter((p) => Date.parse(p.posted_at) > Date.now() - 7 * 86400000).reduce((s, p) => s + Number((metrics[p.id] ?? []).at(-1)?.views ?? 0), 0);
            const best = [...mine].sort((x, y) => Number((metrics[y.id] ?? []).at(-1)?.views ?? 0) - Number((metrics[x.id] ?? []).at(-1)?.views ?? 0))[0];
            return (
              <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><strong style={{ flex: 1 }}>@{a.handle}</strong><Chip k="neutral">{a.platform}</Chip></div>
                <div style={{ fontSize: 13.5 }}>{a.followers?.toLocaleString('en-US') ?? '—'} followers {ch.delta != null && <span style={{ color: ch.delta >= 0 ? 'var(--success)' : 'var(--danger)' }}>{ch.delta >= 0 ? '↑' : '↓'}{Math.abs(ch.delta)}</span>}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>7d views {views7.toLocaleString('en-US')} · 30d avg {avg?.toLocaleString('en-US') ?? '—'}</div>
                {best && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Best: “{(best.hook ?? best.caption ?? '').slice(0, 50)}”</div>}
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{signups(a.handle)} sign-ups traced (30d)</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="The funnel" meta={f.biggestDrop ? `biggest drop: ${f.biggestDrop}` : 'last 14 days of visits, all-time subscriptions'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          {f.steps.map((s) => <Stat key={s.key} label={s.label} value={s.key === 'visits' && visits == null ? '—' : s.count.toLocaleString('en-US')} pill={s.conv != null ? `${s.conv}%` : s.key === 'visits' && visits == null ? 'connect Cloudflare' : undefined} k={s.key === 'churned' && s.count ? 'warn' : undefined} />)}
        </div>
      </Card>

      <Card title="Launch offers" meta="the site's offer cards read this; no prices are hardcoded there">
        {(['founding', 'annual', 'guarantee'] as const).map((k) => {
          const o = offers.find((x) => x.key === k) ?? { key: k, enabled: false, config: { ...OFFER_DEFAULTS[k] }, claimed: 0 };
          const c = o.config as Record<string, number | string>;
          return (
            <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderTop: k === 'founding' ? 'none' : '1px solid var(--grid)' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 170, fontWeight: 600 }}><input type="checkbox" checked={o.enabled} onChange={(e) => void saveOffer(k, { enabled: e.target.checked })} />{String(c.headline ?? k)}</label>
              {k === 'founding' && <>
                <span style={{ fontSize: 13 }}>First <input style={{ ...field, width: 70, height: 32 }} value={Number(c.limit ?? 100)} onChange={(e) => void saveOffer(k, { config: { limit: Number(e.target.value) || 0 } })} /> lock $<input style={{ ...field, width: 70, height: 32 }} value={Number(c.price_usd ?? 19.99)} onChange={(e) => void saveOffer(k, { config: { price_usd: Number(e.target.value) || 0 } })} />/mo for life</span>
                <Chip k="accent">{spotsLeft(Number(c.limit ?? 100), o.claimed)} spots left</Chip>
              </>}
              {k === 'annual' && <span style={{ fontSize: 13 }}>$<input style={{ ...field, width: 80, height: 32 }} value={Number(c.price_usd ?? 179)} onChange={(e) => void saveOffer(k, { config: { price_usd: Number(e.target.value) || 0 } })} /> a year up front</span>}
              {k === 'guarantee' && <span style={{ fontSize: 13 }}><input style={{ ...field, width: 60, height: 32 }} value={Number(c.days ?? 30)} onChange={(e) => void saveOffer(k, { config: { days: Number(e.target.value) || 30 } })} />-day full refund. Refunds go through Stripe from the admin.</span>}
              <input style={{ ...field, height: 32, flex: '1 1 220px' }} placeholder="Stripe coupon or price ID (stays private)" value={String(c.stripe_coupon_id ?? c.stripe_price_id ?? '')} onChange={(e) => void saveOffer(k, { config: k === 'annual' ? { stripe_price_id: e.target.value } : { stripe_coupon_id: e.target.value } })} />
            </div>
          );
        })}
      </Card>

      <Card title="Marketing budget" meta={`$${spent.toFixed(2)} of $${MONTHLY_BUDGET} this month`}>
        <Progress pct={(spent / MONTHLY_BUDGET) * 100} tone={spent > MONTHLY_BUDGET * 0.8 ? 'warn' : undefined} label="Budget used" />
        {channelCosts(channels).filter((c) => c.spend > 0 || c.trials > 0).map((c) => <div key={c.channel} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(3,auto)', gap: 12, fontSize: 13.5 }}><span>{c.channel}</span><span>${c.spend.toFixed(2)}</span><span>{c.perTrial != null ? `$${c.perTrial}/trial` : `${c.trials} trials`}</span><span>{c.perPaid != null ? `$${c.perPaid}/paid` : '—'}</span></div>)}
        <div style={{ fontSize: 14 }}>💡 {plan?.plan.next_20 || tip}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Ad spend comes from Ledger expenses with category "marketing" (party = the channel). The guardrail approves anything over $25.</div>
      </Card>

      <Card title="This week's plan" meta={plan ? `week of ${plan.week_start}` : 'from the Marketing orchestrator'} action={<button className="mm-btn mm-btn--primary" disabled={busy} onClick={() => void runPlan()}>{busy ? 'Planning… (30s)' : plan ? 'Plan again' : 'Plan my week'}</button>}>
        {!plan && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>The orchestrator picks hooks from the idea bank, which posts go on which account, and at most one small paid test within the budget.</div>}
        {plan?.plan.focus && <div style={{ fontSize: 15, fontWeight: 600 }}>{plan.plan.focus}</div>}
        {(plan?.plan.posts ?? []).map((p, i) => <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><Chip k="neutral">{p.day}</Chip><span style={{ flex: 1 }}><strong>{p.account}</strong> · {p.format} · “{p.hook}” <span style={{ color: 'var(--text-tertiary)' }}>— {p.why}</span></span><Thumbs entityType="mkt_plan_post" entityId={`${plan?.id}:${i}`} domain="marketing" compact /></div>)}
        {plan?.plan.paid_test && <div style={{ fontSize: 14 }}>Paid test: ${plan.plan.paid_test.amount_usd} on {plan.plan.paid_test.channel} — {plan.plan.paid_test.why} <Thumbs entityType="mkt_plan_test" entityId={plan.id} domain="marketing" compact /></div>}
      </Card>

      <Card title="Idea bank" meta={`${ideas.filter((i) => i.status === 'idea').length} angles waiting`}>
        <div style={{ display: 'flex', gap: 8 }}><input style={{ ...field, flex: 1 }} placeholder="New angle" value={newIdea} onChange={(e) => setNewIdea(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addIdea(); }} /></div>
        {ideas.filter((i) => i.status !== 'dropped').map((i, k) => <div key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: k ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1, color: i.status === 'posted' ? 'var(--text-tertiary)' : 'var(--text)' }}>{i.angle}</span>{i.status !== 'idea' && <Chip k={i.status === 'posted' ? 'good' : 'accent'}>{i.status}</Chip>}{i.status === 'idea' && <button className="mm-btn" style={{ height: 28, fontSize: 12 }} onClick={() => void setIdea(i.id, 'planned')}>Plan</button>}{i.status === 'planned' && <button className="mm-btn" style={{ height: 28, fontSize: 12 }} onClick={() => void setIdea(i.id, 'posted')}>Posted</button>}<button className="mm-btn" style={{ height: 28, fontSize: 12 }} onClick={() => void setIdea(i.id, 'dropped')}>✕</button></div>)}
      </Card>
      <CaseStudies />
    </div>
  );
}

function CaseStudies() {
  const [rows, setRows] = useState<{ id: string; title: string; quote: string | null; published: boolean; body: { deltas?: { label: string; before: number; after: number; change: string }[] } }[]>([]);
  useEffect(() => { void supabase.from('case_studies').select('id,title,quote,published,body').order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as typeof rows)); }, []);
  return (
    <Card title="Case studies & social proof" meta="ready to drop into posts and the site">
      {rows.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Made from a client's Delivery tab once baseline and later numbers are in.</div>}
      {rows.map((r, i) => <div key={r.id} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><div style={{ display: 'flex', gap: 8 }}><strong style={{ flex: 1 }}>{r.title}</strong>{r.published && <Chip k="good">published</Chip>}</div>{(r.body.deltas ?? []).slice(0, 3).map((d) => <div key={d.label} style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{d.label}: {d.before} → {d.after} ({d.change})</div>)}{r.quote && <div style={{ fontStyle: 'italic', fontSize: 13 }}>“{r.quote}”</div>}<button className="mm-btn" style={{ height: 28, fontSize: 12, marginTop: 4 }} onClick={() => void navigator.clipboard?.writeText(`${r.title}\n${(r.body.deltas ?? []).map((d) => `${d.label}: ${d.before} → ${d.after} (${d.change})`).join('\n')}${r.quote ? `\n“${r.quote}”` : ''}`)}>Copy for a post</button></div>)}
    </Card>
  );
}
