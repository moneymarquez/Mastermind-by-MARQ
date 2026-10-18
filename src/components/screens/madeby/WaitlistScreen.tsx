import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { Page, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { waitlistCsv, waitlistStats } from '../../../../worker/lib/waitlist';
import type { WaitlistRow } from '../../../../worker/lib/waitlist';

interface Row extends WaitlistRow { id: string; mailerlite_synced_at: string | null; mailerlite_error: string | null }

/** Waitlist (Addendum 2 §1): who joined, founding spots, signups per day and
 *  per code, CSV, the public site's launch switch, and the Launch button. */
export default function WaitlistScreen() {
  const phone = useModule().device === 'phone';
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<'waitlist' | 'open'>('waitlist');
  const [limit, setLimit] = useState(100);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from('waitlist').select('id,email,name,code,source,spot_number,founding_spot,created_at,mailerlite_synced_at,mailerlite_error').order('spot_number', { ascending: false }).limit(5000),
      fetch('/api/site/config').then((x) => (x.ok ? x.json() : null)).catch(() => null) as Promise<{ launch_mode?: 'waitlist' | 'open'; founding?: { limit?: number } } | null>,
    ]);
    setMissing(!!r.error);
    setRows((r.data ?? []) as Row[]);
    if (c?.launch_mode) setMode(c.launch_mode);
    if (c?.founding?.limit) setLimit(c.founding.limit);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => waitlistStats(rows, limit), [rows, limit]);
  const today = new Date().toISOString().slice(0, 10);
  const todayN = stats.days.find((d) => d.date === today)?.n ?? 0;
  const maxDay = Math.max(1, ...stats.days.map((d) => d.n));
  const waiting = rows.filter((r) => !r.mailerlite_synced_at).length;

  const call = async (path: string, body: Record<string, unknown> = {}) => {
    setBusy(true); setMsg('');
    const r = await api<{ detail?: string; error?: string; launch_mode?: 'waitlist' | 'open' }>(`/api/waitlist/${path}`, { body });
    setMsg(r.detail ?? r.error ?? (r.launch_mode ? `Public site is now: ${r.launch_mode}.` : 'Done.'));
    if (r.launch_mode) setMode(r.launch_mode);
    setBusy(false); void load();
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([waitlistCsv([...rows].sort((a, b) => a.spot_number - b.spot_number))], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `masterminds-waitlist-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (missing) return <Page title="Waitlist"><Empty text="Waitlist needs the schema_128 migration applied." /></Page>;
  return (
    <Page title="Waitlist" sub="Everyone who joined before launch. The public site shows this form while launch mode is Waitlist.">
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4,minmax(0,1fr))', gap: phone ? 10 : 16 }}>
        <Stat label="Signups" value={String(stats.total)} pill={`${todayN} today`} k={todayN ? 'good' : 'neutral'} />
        <Stat label="Founding spots used" value={`${stats.foundingUsed}/${limit}`} pill={`${stats.spotsLeft} left`} k={stats.spotsLeft ? 'neutral' : 'good'} />
        <Stat label="Came with a code" value={String(stats.withCode)} pill={stats.total ? `${Math.round((stats.withCode / stats.total) * 100)}%` : '—'} />
        <Stat label="Waiting for MailerLite" value={String(waiting)} pill={waiting ? 'test mode holds them' : 'all synced'} k={waiting ? 'warn' : 'good'} />
      </div>

      <Card title="Public site" meta={`launch mode: ${mode}`}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', flex: '1 1 260px' }}>{mode === 'waitlist' ? 'Every sign-up button says "Join the waitlist" and collects emails.' : 'The site takes sign-ups and payment as normal.'}</span>
          <button className="mm-btn" disabled={busy} onClick={() => { if (mode === 'open' || window.confirm('Switch the public site to open sign-ups? Pay buttons come back immediately.')) void call('mode', { mode: mode === 'waitlist' ? 'open' : 'waitlist' }); }}>{mode === 'waitlist' ? 'Switch to open' : 'Back to waitlist'}</button>
          <button className="mm-btn" disabled={busy || !waiting} onClick={() => void call('sync')}>Sync to MailerLite{waiting ? ` (${waiting})` : ''}</button>
          <button className="mm-btn mm-btn--primary" disabled={busy || mode === 'open'} onClick={() => { if (window.confirm('Launch? This opens the doors and drafts a campaign to the whole waitlist in MailerLite (nothing is sent until you press Send there).')) void call('launch'); }}>Launch</button>
        </div>
        {msg && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{msg}</div>}
      </Card>

      <Card title="Signups per day" meta="last 14 days">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
          {stats.days.map((d) => (
            <div key={d.date} title={`${d.date}: ${d.n}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, justifyContent: 'flex-end', height: '100%' }}>
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{d.n || ''}</span>
              <div style={{ width: '100%', height: `${Math.max(3, (d.n / maxDay) * 62)}px`, borderRadius: 3, background: d.n ? 'var(--accent)' : 'var(--surface-2)' }} />
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 2fr', gap: 16, alignItems: 'start' }}>
        <Card title="By code" meta="who drove signups">
          {stats.byCode.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No codes used yet. Share a link like mastermindsbymarq.com/?code=MARQ20.</div>}
          {stats.byCode.map((c, i) => (
            <div key={c.code} style={{ display: 'flex', gap: 8, padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1, fontFamily: 'var(--font-mono, monospace)' }}>{c.code}</span><strong>{c.n}</strong></div>
          ))}
        </Card>
        <Card title="Signups" meta={`${rows.length}`} action={<button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={exportCsv} disabled={!rows.length}>Export CSV</button>}>
          {rows.length === 0 && <Empty text="No one has joined yet." />}
          {rows.slice(0, 100).map((r, i) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12.5, minWidth: 34 }}>#{r.spot_number}</span>
              <span style={{ minWidth: 0 }}><span style={{ overflowWrap: 'anywhere' }}>{r.email}</span><span style={{ display: 'block', fontSize: 12.5, color: r.mailerlite_error ? 'var(--danger)' : 'var(--text-tertiary)' }}>{[r.name, r.code, new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }), r.mailerlite_error ? `MailerLite: ${r.mailerlite_error}` : r.mailerlite_synced_at ? 'in MailerLite' : 'not in MailerLite yet'].filter(Boolean).join(' · ')}</span></span>
              {r.founding_spot ? <Chip k="good">founding</Chip> : <span />}
            </div>
          ))}
        </Card>
      </div>
    </Page>
  );
}
