import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { Page, Sheet, Field, field, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { describeCoupon } from '../../../../worker/lib/coupons';
import type { CouponRow } from '../../../../worker/lib/coupons';

type Stat = { signups: number; redeemed: number | null; paid: number; revenue: number };
const SITE = 'https://mastermindsbymarq.com';

/** Coupons (Addendum 2 §2): make a code, hand it out, and it just works. It
 *  becomes a Stripe coupon + promotion code (test mode while test mode is on),
 *  carries a shareable link, and counts waitlist signups, redemptions and revenue. */
export default function CouponsScreen() {
  const phone = useModule().device === 'phone';
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [mode, setMode] = useState<{ mode: 'test' | 'live' | null; reason: string }>({ mode: null, reason: '' });
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const load = useCallback(async () => {
    const r = await supabase.from('coupons').select('*').order('created_at', { ascending: true });
    setMissing(!!r.error);
    setRows((r.data ?? []) as CouponRow[]);
    const [st, s] = await Promise.all([api<{ mode: 'test' | 'live' | null; reason: string }>('/api/coupons/status'), api<{ stats?: Record<string, Stat> }>('/api/coupons/stats', { body: {} })]);
    if (!st.error) setMode({ mode: st.mode ?? null, reason: st.reason ?? '' });
    setStats(s.stats ?? {});
  }, []);
  useEffect(() => { void load(); }, [load]);

  const call = async (path: string, body: Record<string, unknown>, key: string) => {
    setBusy(key); setMsg('');
    const r = await api<{ error?: string; push?: { ok: boolean; error?: string; mode?: string | null }; ok?: boolean; mode?: string | null }>(`/api/coupons/${path}`, { body });
    setMsg(r.error ?? r.push?.error ?? (r.push?.ok ? `Created in Stripe ${r.push.mode} mode.` : r.ok === false ? 'Stripe said no.' : 'Done.'));
    setBusy(''); void load();
  };
  const link = (c: CouponRow) => `${SITE}/?code=${c.code}`;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setMsg(`Copied ${text}`); } catch { setMsg(text); } };
  const inStripe = (c: CouponRow) => (mode.mode === 'live' ? !!c.stripe_live_promo_id : mode.mode === 'test' ? !!c.stripe_test_promo_id : false);
  const set = (k: string, v: string) => setForm((f) => ({ ...(f ?? {}), [k]: v }));

  if (missing) return <Page title="Coupons"><Empty text="Coupons need the schema_128 migration applied." /></Page>;
  return (
    <Page title="Coupons" sub="Make a code, share its link, and it applies at the waitlist and at checkout." fab={{ t: 'Code', onClick: () => setForm({ kind: 'promoter', percent_off: '20', duration: 'repeating', duration_months: '3' }) }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip k={mode.mode === 'live' ? 'good' : mode.mode === 'test' ? 'warn' : 'neutral'}>{mode.mode ? `Stripe ${mode.mode} mode` : 'Stripe not connected for this mode'}</Chip>
        {mode.reason && <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: '1 1 280px' }}>{mode.reason}</span>}
      </div>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
      {rows.length === 0 && <Empty text="No codes yet. Tap + Code." />}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
        {rows.map((c) => {
          const s = stats[c.id];
          return (
            <Card key={c.id} title={c.code} meta={c.owner_label ? `for ${c.owner_label}` : c.kind}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: c.active ? 1 : 0.6 }}>
                <div style={{ fontSize: 14 }}>{describeCoupon(c)}{c.max_redemptions ? ` · max ${c.max_redemptions}` : ''}{c.expires_at ? ` · until ${new Date(c.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</div>
                {c.label && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{c.label}</div>}
                <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{s?.signups ?? 0}</strong> waitlist signups</span>
                  <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{s?.redeemed ?? (s?.paid ?? 0)}</strong> redeemed</span>
                  <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>${(s?.revenue ?? 0).toFixed(0)}</strong> revenue</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip k={inStripe(c) ? 'good' : 'warn'}>{inStripe(c) ? `in Stripe ${mode.mode}` : 'draft: not in Stripe yet'}</Chip>
                  {!c.active && <Chip k="neutral">off</Chip>}
                </div>
                {c.last_error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{c.last_error}</div>}
                <code style={{ fontSize: 12.5, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{link(c)}</code>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => void copy(link(c))}>Copy link</button>
                  {!inStripe(c) && <button className="mm-btn mm-btn--primary" style={{ height: 32, fontSize: 13 }} disabled={busy === c.id || !mode.mode} onClick={() => void call('push', { id: c.id }, c.id)}>Push to Stripe</button>}
                  <button className="mm-btn" style={{ height: 32, fontSize: 13 }} disabled={busy === c.id} onClick={() => void call('toggle', { id: c.id, active: !c.active }, c.id)}>{c.active ? 'Deactivate' : 'Reactivate'}</button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {form && (
        <Sheet title="New code" onClose={() => setForm(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Code"><input style={field} autoFocus value={form.code ?? ''} placeholder="JAMES20" onChange={(e) => set('code', e.target.value.toUpperCase())} /></Field>
            <Field l="Whose is it? (optional)"><input style={field} value={form.owner_label ?? ''} placeholder="James" onChange={(e) => set('owner_label', e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="% off"><input style={field} inputMode="decimal" value={form.percent_off ?? ''} onChange={(e) => setForm((f) => ({ ...(f ?? {}), percent_off: e.target.value, amount_off_usd: '' }))} /></Field>
              <Field l="or $ off"><input style={field} inputMode="decimal" value={form.amount_off_usd ?? ''} onChange={(e) => setForm((f) => ({ ...(f ?? {}), amount_off_usd: e.target.value, percent_off: '' }))} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="How long"><select style={field} value={form.duration ?? 'once'} onChange={(e) => set('duration', e.target.value)}><option value="once">Once (first payment)</option><option value="repeating">Several months</option><option value="forever">Forever</option></select></Field>
              {form.duration === 'repeating' && <Field l="Months"><input style={field} inputMode="numeric" value={form.duration_months ?? ''} onChange={(e) => set('duration_months', e.target.value)} /></Field>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Max uses (optional)"><input style={field} inputMode="numeric" value={form.max_redemptions ?? ''} onChange={(e) => set('max_redemptions', e.target.value)} /></Field>
              <Field l="Expires (optional)"><input type="date" style={field} value={form.expires_at ?? ''} onChange={(e) => set('expires_at', e.target.value)} /></Field>
            </div>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!form.code?.trim() || busy === 'new'} onClick={async () => { await call('create', form, 'new'); setForm(null); }}>Save code</button>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{mode.mode ? `It's created in Stripe ${mode.mode} mode.` : 'It saves as a draft and goes to Stripe when a key for this mode is added.'}</div>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
