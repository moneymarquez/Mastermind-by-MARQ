import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { field } from '../../mm/Page';
import { funnel, OFFER_DEFAULTS, spotsLeft } from '../../../data/madeby';
import { TAB_TYPES } from '../../../data/mktBrands';
import BrandMarketing from './BrandMarketing';

type Offer = { key: 'founding' | 'annual' | 'guarantee'; enabled: boolean; config: Record<string, unknown>; claimed: number };

/** Made by Marq → Marketing → Brands: the shared brand marketing view for
 *  Masterminds (the app), Made by Marq itself and clients (Addendum 2 §3),
 *  with the Masterminds funnel, launch offers and case studies underneath. */
export default function OurBrandsTab() {
  const [visits, setVisits] = useState<number | null>(null);
  const [subs, setSubs] = useState<{ trials: number; paid: number; churned: number } | null>(null);
  const [waitlist, setWaitlist] = useState(0);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const [o, w] = await Promise.all([supabase.from('launch_offers').select('key,enabled,config,claimed'), supabase.from('waitlist').select('id', { count: 'exact', head: true })]);
    setOffers((o.data ?? []) as Offer[]);
    setWaitlist(w.count ?? 0);
    void api<{ daily?: { visits: number }[]; total?: number; error?: string }>('/api/marketing/visits?venture=masterminds').then((r) => setVisits(r.error ? null : r.total ?? (r.daily ?? []).reduce((s, d) => s + Number(d.visits ?? 0), 0)));
    void api<{ trials: number; paid: number; churned: number; error?: string }>('/api/marketing/funnel', { method: 'POST', body: {} }).then((r) => setSubs(r.error ? null : r));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const f = useMemo(() => funnel([{ key: 'visits', label: 'Site visitors', count: visits ?? 0 }, { key: 'waitlist', label: 'Waitlist', count: waitlist }, { key: 'trials', label: 'Trial starts', count: subs?.trials ?? 0 }, { key: 'paid', label: 'Paid', count: subs?.paid ?? 0 }]), [visits, waitlist, subs]);

  const saveOffer = async (key: Offer['key'], patch: Partial<Offer>) => {
    const cur = offers.find((o) => o.key === key) ?? { key, enabled: false, config: { ...OFFER_DEFAULTS[key] }, claimed: 0 };
    const next = { ...cur, ...patch, config: { ...cur.config, ...(patch.config ?? {}) } };
    setOffers((xs) => [...xs.filter((x) => x.key !== key), next]);
    const { error } = await supabase.from('launch_offers').upsert({ key, enabled: next.enabled, config: next.config, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
    setMsg(error ? error.message : 'Saved. The site reads this.');
  };
  return (
    <div>
      {msg && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 12 }}>{msg}</div>}
      <BrandMarketing types={TAB_TYPES.madeby} empty="Masterminds and Made by Marq appear here once the schema_130 migration is applied. Clients appear when they're active.">
        {(brand) => brand.type === 'app' ? (
          <>
      <Card title="The funnel" meta={f.biggestDrop ? `biggest drop: ${f.biggestDrop}` : 'visits → waitlist → paid'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
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

          </>
        ) : null}
      </BrandMarketing>
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
