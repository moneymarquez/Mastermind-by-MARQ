import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Page, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import { INTEGRATIONS, areas, integrationState, DRY_RUN_HOW } from '../../../data/health';
import type { AreaMode, HealthInput } from '../../../data/health';

// System Health (Oct 2026): DRY_RUN / live per area, which keys are set
// (presence only: the Worker never sends a value), the last overnight run
// and its tasks, the timers, failures and pending approvals, and the exact
// go-live checklist area by area.

export interface HealthStatus extends HealthInput {
  error?: string;
  now: string; date: string; tz: string;
  window: { start: number; end: number };
  lastRun: { date: string; plan: { key: string; label: string; domain: string }[]; tasks: { key: string; status: string; note: string | null; at: string }[] } | null;
  failed: { tasks: { id: string; what: string; note: string | null; at: string }[]; runs: { id: string; worker: string; error: string | null; at: string }[] };
  approvals: { total: number; money: number; byKey: Record<string, number> };
  crons: { cron: string; label: string; jobs: string; names?: string[] }[];
}

const MODE: Record<AreaMode, { label: string; k: ChipKind }> = { live: { label: 'Live', k: 'live' }, test: { label: 'Test mode', k: 'warn' }, off: { label: 'Not set up', k: 'neutral' } };
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' MT';
const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const STATUS_K: Record<string, ChipKind> = { done: 'good', failed: 'bad', waiting: 'warn', running: 'accent' };
const DOMAIN: Record<string, string> = { ecom: 'E-commerce', content: 'Content', marketing: 'Marketing', digest: 'Digest' };

function useHealth() {
  const [s, setS] = useState<HealthStatus | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { const r = await api<HealthStatus>('/api/system/health', { method: 'GET' }); if (r.error && !r.secrets) setErr(r.error); else { setS(r); setErr(r.error ?? ''); } }, []);
  useEffect(() => { void load(); }, [load]);
  return { s, err, load };
}

export default function SystemHealthScreen() {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const { s, err, load } = useHealth();
  const list = s ? areas({ dryRun: s.dryRun, secrets: s.secrets ?? {}, accounts: s.accounts ?? [], livePostingAccounts: s.livePostingAccounts ?? 0, socialAccounts: s.socialAccounts ?? 0, orchestratorEnabled: !!s.orchestratorEnabled }) : [];
  const live = list.filter((a) => a.mode === 'live').length;
  const tasks = s?.lastRun?.tasks ?? [];
  const failedCount = (s?.failed?.tasks.length ?? 0) + (s?.failed?.runs.length ?? 0);
  return (
    <Page title="System health" sub="What's live, what's in test mode, which keys are set, and what you have to do to go live" back="HQ" backTo="hq" right={{ t: 'Refresh', onClick: () => void load() }}>
      {err && <div style={{ padding: '12px 14px', borderRadius: 'var(--g-r-lg)', border: '1px solid color-mix(in srgb, var(--warning) 40%, var(--border))', background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))', fontSize: 14 }}>{err}</div>}
      {!s && !err && <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Checking…</div>}
      {s && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4,minmax(0,1fr))', gap: phone ? 10 : 16 }}>
            <Stat label="Mode" value={s.dryRun ? 'Test' : 'Live'} pill={s.dryRun ? 'DRY_RUN on: nothing goes out' : 'Sends are real'} k={s.dryRun ? 'warn' : 'good'} />
            <Stat label="Areas live" value={`${live} of ${list.length}`} />
            <Stat label="Failed (24h–7d)" value={String(failedCount)} k={failedCount ? 'bad' : 'good'} />
            <Stat label="Waiting on you" value={String(s.approvals?.total ?? 0)} pill={s.approvals?.money ? `${s.approvals.money} with money` : undefined} onClick={() => nav('ecom-approvals')} />
          </div>
          <Card title="Go live, area by area" meta={s.dryRun ? 'DRY_RUN is on' : 'DRY_RUN is off'}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {s.dryRun ? 'Test mode is on for the whole app (DRY_RUN in wrangler.jsonc). Outbound email, store launches, paid generation, coupons, domains and waitlist sync are logged instead of done. Two areas have their own switch: texting (TWILIO_LIVE) and posting (per account). Get each area ready first.' : 'DRY_RUN is off: every area that is set up acts for real.'}
            </div>
            {s.dryRun && <div style={{ fontSize: 14, color: 'var(--text)', padding: '10px 12px', borderRadius: 'var(--g-r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}><b style={{ fontWeight: 600 }}>The DRY_RUN switch:</b> {DRY_RUN_HOW}</div>}
            {list.map((a) => (
              <div key={a.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                  <Chip k={MODE[a.mode].k}>{MODE[a.mode].label}</Chip>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{a.detail}</div>
                {a.todo.length > 0 && (
                  <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {a.todo.map((t, i) => <li key={i} style={{ fontSize: 14, color: 'var(--text)' }}>{t}</li>)}
                  </ol>
                )}
              </div>
            ))}
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: phone ? 12 : 16, alignItems: 'start' }}>
            <Card title="Keys and connections" meta="Set or not; values never leave the server">
              {INTEGRATIONS.map((i) => {
                const st = integrationState(i, { secrets: s.secrets ?? {}, accounts: s.accounts ?? [] });
                return (
                  <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{i.name}</span>
                      <Chip k={st.state === 'ready' ? 'good' : st.state === 'partial' ? 'warn' : 'neutral'}>{st.state === 'ready' ? 'Set' : st.state === 'partial' ? 'Partly set' : 'Not set'}</Chip>
                    </div>
                    {st.missing.length > 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Missing: {st.missing.join(', ')}</div>}
                    {i.note && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{i.note}</div>}
                  </div>
                );
              })}
              <button className="mm-btn" onClick={() => nav('setup')}>Open Setup to add keys</button>
            </Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 12 : 16 }}>
              <Card title="Last overnight run" meta={s.lastRun ? s.lastRun.date : 'Never'}>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Window {hhmm(s.window?.start ?? 210)}–{hhmm(s.window?.end ?? 420)} AM Denver, one step every 5 minutes. {s.orchestratorEnabled ? '' : 'The orchestrator is turned off.'}</div>
                {!s.lastRun && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No overnight run on record yet.</div>}
                {s.lastRun?.plan.map((p) => {
                  const t = tasks.find((x) => x.key === p.key);
                  return (
                    <div key={p.key} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      <Chip k={t ? STATUS_K[t.status] ?? 'neutral' : 'neutral'}>{t ? t.status : 'not run'}</Chip>
                      <span style={{ color: 'var(--text)', minWidth: 0 }}>{p.label}{t?.note ? <span style={{ color: 'var(--text-secondary)' }}> · {t.note}</span> : null}</span>
                    </div>
                  );
                })}
              </Card>
              <Card title="Failed" meta={failedCount ? `${failedCount}` : 'None'}>
                {!failedCount && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nothing failed in the last day (runs) or week (tasks).</div>}
                {s.failed?.tasks.map((t) => <div key={t.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text)', fontWeight: 500 }}>{t.what}</b> · {t.note} · {when(t.at)}</div>)}
                {s.failed?.runs.map((r) => <div key={r.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text)', fontWeight: 500 }}>{r.worker}</b> · {r.error} · {when(r.at)}</div>)}
              </Card>
              <Card title="Waiting on you" meta={`${s.approvals?.total ?? 0}`}>
                {Object.entries(s.approvals?.byKey ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [d, type] = k.split(':'); return <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}><span>{DOMAIN[d] ?? d} · {type.replace(/_/g, ' ')}</span><span>{n}</span></div>; })}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="mm-btn" onClick={() => nav('ecom-approvals')}>Approvals</button>
                  <button className="mm-btn" onClick={() => nav('class-notes')}>Class notes</button>
                </div>
              </Card>
              <Card title="Timers (crons)">
                {s.crons?.map((c) => (
                  <div key={c.cron} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Chip k="accent">{c.cron}</Chip><span style={{ fontSize: 14, color: 'var(--text)' }}>{c.label}</span></div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.jobs}</div>
                    {c.names?.length ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Jobs: {c.names.join(', ')}</div> : null}
                  </div>
                ))}
              </Card>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Checked {when(s.now)}.</div>
        </>
      )}
    </Page>
  );
}
