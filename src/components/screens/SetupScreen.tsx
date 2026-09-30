import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../../lib/api';
import { PLATFORM_SETUP, ACCOUNT_SETUP } from '../../data/setupCatalog';
import type { SetupEntry } from '../../data/setupCatalog';
import { WORKERS, AUTONOMY_LABEL } from '../../data/ecom';
import { startCompany, usePlaybooks } from '../../data/useEngine';
import { supabase } from '../../lib/supabase';
import { E, Badge, Pill, TeachingEmpty, btn, field, label, panel, tint } from './ecom/ecomShared';
import { askConfirm } from '../../lib/confirm';

interface Props { homeHeadStyle: CSSProperties; homeSubStyle: CSSProperties; onNavigate?: (id: string) => void }
interface Status {
  owner: boolean; canWriteSecrets: boolean; encryption: string; replyWebhook: string; oauthRedirect: string;
  platform: { id: string; present: { secret: string; set: boolean }[] }[];
  accounts: { id: string; connected: boolean; appReady: boolean }[];
  connections: { provider: string; status: string; last_tested_at: string | null; note: string | null }[];
  error?: string;
}
type Tab = 'platform' | 'accounts' | 'start';

/** Setup (Appendix 5, Part 2): plain-language explain → how to get it →
 *  what breaks without it → input → live Test, green or red with the real
 *  error. Platform keys are admin-only Worker secrets; account connections
 *  are per user and sealed server-side. The last tab starts the company. */
export default function SetupScreen({ homeHeadStyle, homeSubStyle, onNavigate }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [tab, setTab] = useState<Tab>('platform');
  const [flash, setFlash] = useState('');
  const [loadError, setLoadError] = useState('');
  // A failed status call (offline, signed out, Worker error) shows the
  // error instead of rendering half a page from a partial object.
  const load = () => api<Status>('/api/setup/status').then((s) => {
    if (s.error || !Array.isArray(s.connections)) { setLoadError(s.error ?? 'Setup status came back incomplete.'); setStatus(null); return; }
    setLoadError(''); setStatus(s); if (!s.owner) setTab((t) => (t === 'platform' ? 'accounts' : t));
  });
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get('connected')) { setFlash(`Connected ${q.get('connected')}.`); setTab('accounts'); }
    if (q.get('connect_error')) { setFlash(`Connect failed: ${q.get('connect_error')}`); setTab('accounts'); }
    if (q.get('connected') || q.get('connect_error')) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const conn = (id: string) => status?.connections?.find((c) => c.provider === id);

  return (
    <div>
      <div style={homeHeadStyle}>Setup</div>
      <div style={homeSubStyle}>Everything Mastermind needs from the outside, one screen each: what it does, where to get it, and a live test.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
        {status?.owner !== false && <Pill active={tab === 'platform'} onClick={() => setTab('platform')}>🔑 Platform setup</Pill>}
        <Pill active={tab === 'accounts'} onClick={() => setTab('accounts')}>🔗 My connections</Pill>
        {status?.owner !== false && <Pill active={tab === 'start'} onClick={() => setTab('start')}>🏢 Start the company</Pill>}
      </div>
      <div style={{ ...panel, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {flash && <div style={{ ...E.card, padding: 10, borderColor: flash.startsWith('Connect failed') ? E.red : E.green, fontSize: 'var(--text-body)' }}>{flash}</div>}
        {loadError && <div style={{ color: E.red }}>Couldn't load Setup: {loadError} <button style={{ ...btn('ghost'), padding: '3px 10px', fontSize: 12, marginLeft: 6 }} onClick={load}>Retry</button></div>}
        {!status && !loadError && <div style={{ color: E.faint }}>Checking what's connected…</div>}
        {status && tab === 'platform' && (
          <>
            <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.5 }}>
              Keys here are yours only, set once, and power the workers for everyone (usage is tracked per user in the cost ledger). They're stored as Cloudflare Worker secrets — never in the browser or a table.{' '}
              {status.canWriteSecrets ? <Badge color={E.green}>Save buttons write secrets directly</Badge> : <Badge color={E.amber}>Save needs the Cloudflare token first — see that card</Badge>}
            </div>
            {!status.canWriteSecrets && (
              <div style={{ ...E.card, padding: 14, borderColor: E.amber, background: tint(E.amber, 8) }}>
                <div style={{ fontWeight: 700, color: E.text }}>Do this first: the Cloudflare card below</div>
                <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4, lineHeight: 1.5 }}>
                  This page saves keys by writing them into Cloudflare for you. It can't do that until two values — <span style={{ fontFamily: 'var(--font-mono)' }}>CF_API_TOKEN</span> and <span style={{ fontFamily: 'var(--font-mono)' }}>CF_ACCOUNT_ID</span> — are added by hand in the Cloudflare dashboard, once. After that, type any key here and Save works. Until then you can still type into any box; Save will tell you where to put it instead.
                </div>
              </div>
            )}
            {[...PLATFORM_SETUP].sort((a, b) => (status.canWriteSecrets ? 0 : (a.id === 'cloudflare_secrets' ? -1 : b.id === 'cloudflare_secrets' ? 1 : 0))).map((p) => <PlatformCard key={p.id} startOpen={!status.canWriteSecrets && p.id === 'cloudflare_secrets'} p={p} present={status.platform.find((x) => x.id === p.id)?.present ?? []} conn={conn(p.id)} canWrite={status.canWriteSecrets} extra={p.id === 'twilio' ? status.replyWebhook : undefined} onChanged={load} />)}
            <AppSecretsCard status={status} onChanged={load} />
          </>
        )}
        {status && tab === 'accounts' && (
          <>
            <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.5 }}>Every user connects their own accounts — nobody can read your Instagram with someone else's login. Tokens are encrypted on the server ({status.encryption}); this browser never holds them.</div>
            {ACCOUNT_SETUP.map((a) => <AccountCard key={a.id} a={a} state={status.accounts.find((x) => x.id === a.id)} conn={conn(a.id)} onChanged={load} />)}
          </>
        )}
        {status && tab === 'start' && <StartCompany onNavigate={onNavigate} />}
      </div>
    </div>
  );
}

function Steps({ e }: { e: SetupEntry }) {
  return (
    <ol style={{ margin: '6px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {e.steps.map((s, i) => <li key={i} style={{ fontSize: 'var(--text-body)', color: E.text, lineHeight: 1.45 }}>{s.text} {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: E.blue, whiteSpace: 'nowrap' }}>Open ↗</a>}</li>)}
    </ol>
  );
}

function TestLine({ conn }: { conn?: Status['connections'][number] }) {
  if (!conn) return <Badge color={E.faint}>not tested</Badge>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge color={conn.status === 'connected' ? E.green : E.red}>{conn.status === 'connected' ? '● connected' : '● failing'}</Badge>
      <span style={{ fontSize: 'var(--text-caption)', color: conn.status === 'connected' ? E.muted : E.red, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{conn.note}</span>
      {conn.last_tested_at && <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>· {new Date(conn.last_tested_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
    </span>
  );
}

function PlatformCard({ p, present, conn, canWrite, extra, onChanged, startOpen }: { startOpen?: boolean; p: SetupEntry; present: { secret: string; set: boolean }[]; conn?: Status['connections'][number]; canWrite: boolean; extra?: string; onChanged: () => void }) {
  const [open, setOpen] = useState(!!startOpen);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const allSet = present.length > 0 && present.every((x) => x.set);
  const test = async () => { setBusy('test'); const r = await api<{ ok: boolean; detail: string }>('/api/setup/test', { body: { provider: p.id } }); setMsg(r.error ?? ''); setBusy(''); onChanged(); };
  const save = async () => {
    setBusy('save'); setMsg('');
    if (p.id === 'cloudflare_secrets' && !canWrite) {
      setMsg('These two can\'t be saved from here — they\'re what lets this page save. Add them in Cloudflare (step 4 above), then press Test.');
      setBusy(''); return;
    }
    for (const [name, value] of Object.entries(vals)) {
      if (!value.trim()) continue;
      const r = await api<{ ok?: boolean; detail?: string }>('/api/setup/secret', { body: { name, value } });
      if (r.error) { setMsg(r.error); setBusy(''); return; }
    }
    setVals({}); setMsg('Saved. Testing in a few seconds…'); setBusy('');
    setTimeout(test, 4000);
  };
  return (
    <div style={{ ...E.card, padding: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: conn?.status === 'connected' ? E.green : allSet ? E.amber : E.faint, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: E.text, flex: 1 }}>{p.name}</span>
        {p.phase && <Badge color={E.faint}>{p.phase}</Badge>}
        <span style={{ color: E.faint }}>{open ? '▾' : '▸'}</span>
      </div>
      <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4, lineHeight: 1.45 }}>{p.powers}</div>
      <div style={{ marginTop: 6 }}><TestLine conn={conn} /></div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={label}>How to get it</div>
          <Steps e={p} />
          <div style={{ ...label, marginTop: 10 }}>Without it</div>
          <div style={{ fontSize: 'var(--text-body)', color: E.muted }}>{p.withoutIt}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {p.fields.map((f) => {
              const isSet = present.find((x) => x.secret === f.secret)?.set;
              return (
                <div key={f.secret}>
                  <div style={{ ...label, marginBottom: 4, display: 'flex', gap: 6 }}>{f.label} <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0 }}>{f.secret}</span> {isSet ? <Badge color={E.green}>set</Badge> : <Badge color={E.amber}>missing</Badge>}</div>
                  <input style={field} type="password" autoComplete="off" placeholder={isSet ? '•••••••• (set — type to replace)' : f.placeholder ?? ''} value={vals[f.secret] ?? ''} onChange={(e) => setVals({ ...vals, [f.secret]: e.target.value })} />
                </div>
              );
            })}
          </div>
          {extra && <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 8 }}>Reply webhook for Twilio: <span style={{ fontFamily: 'var(--font-mono)', color: E.muted, wordBreak: 'break-all' }}>{extra}</span> (HTTP POST)</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button style={btn('primary')} disabled={!!busy || !Object.values(vals).some((v) => v.trim())} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            {p.testable && <button style={btn('ghost')} disabled={!!busy} onClick={test}>{busy === 'test' ? 'Testing…' : 'Test'}</button>}
          </div>
          {!canWrite && p.id !== 'cloudflare_secrets' && <div style={{ fontSize: 'var(--text-caption)', color: E.amber, marginTop: 6 }}>Save needs the Cloudflare card done first. Or add these yourself: Cloudflare → Workers & Pages → mastermind-by-marq → Settings → Variables and Secrets → Add → type Secret, using the exact names shown, then press Test here.</div>}
          {msg && <div style={{ fontSize: 'var(--text-caption)', color: msg.startsWith('Saved') ? E.green : E.red, marginTop: 6 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

/** The developer-app keys behind the Instagram and TikTok Connect buttons,
 *  plus the dedicated token-encryption key. Admin only. */
function AppSecretsCard({ status, onChanged }: { status: Status; onChanged: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const rows: { secret: string; label: string; help: string }[] = [
    { secret: 'INSTAGRAM_APP_ID', label: 'Instagram app ID', help: 'developers.facebook.com → My Apps → Create app → type Business → add "Instagram" (Instagram API with Instagram Login) → App settings → Basic.' },
    { secret: 'INSTAGRAM_APP_SECRET', label: 'Instagram app secret', help: 'Same page. Add the redirect URL below under Instagram → API setup → Business login settings.' },
    { secret: 'TIKTOK_CLIENT_KEY', label: 'TikTok client key', help: 'developers.tiktok.com → Manage apps → your app → add Login Kit + Display API, scopes user.info.basic and video.list, redirect URL below.' },
    { secret: 'TIKTOK_CLIENT_SECRET', label: 'TikTok client secret', help: 'Same page.' },
    { secret: 'TOKEN_ENCRYPTION_KEY', label: 'Token encryption key (optional)', help: 'A random 32-byte base64 string (run: openssl rand -base64 32). Without it, tokens are sealed with a key derived from the service key. Setting it later means reconnecting accounts once.' },
  ];
  const save = async () => {
    for (const [name, value] of Object.entries(vals)) {
      if (!value.trim()) continue;
      const r = await api('/api/setup/secret', { body: { name, value } });
      if (r.error) { setMsg(r.error); return; }
    }
    setVals({}); setMsg('Saved.'); onChanged();
  };
  const readyIg = status.accounts.find((a) => a.id === 'instagram')?.appReady;
  const readyTt = status.accounts.find((a) => a.id === 'tiktok')?.appReady;
  return (
    <div style={{ ...E.card, padding: 14 }}>
      <div style={{ fontWeight: 700, color: E.text }}>Developer apps for account connections</div>
      <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}>One Instagram app and one TikTok app for all of Mastermind; each user then taps Connect with their own login. Both need the privacy-policy URL from Marketing Stage Zero before Meta or TikTok approve them.</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><Badge color={readyIg ? E.green : E.amber}>Instagram app {readyIg ? 'ready' : 'not set'}</Badge><Badge color={readyTt ? E.green : E.amber}>TikTok app {readyTt ? 'ready' : 'not set'}</Badge></div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 8 }}>OAuth redirect URL for both: <span style={{ fontFamily: 'var(--font-mono)', color: E.muted, wordBreak: 'break-all' }}>{status.oauthRedirect}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {rows.map((r) => (
          <div key={r.secret}>
            <div style={{ ...label, marginBottom: 2 }}>{r.label} <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0 }}>{r.secret}</span></div>
            <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginBottom: 4 }}>{r.help}</div>
            <input style={field} type="password" autoComplete="off" value={vals[r.secret] ?? ''} onChange={(e) => setVals({ ...vals, [r.secret]: e.target.value })} />
          </div>
        ))}
      </div>
      <button style={{ ...btn('primary'), marginTop: 10 }} disabled={!Object.values(vals).some((v) => v.trim())} onClick={save}>Save</button>
      {msg && <span style={{ fontSize: 'var(--text-caption)', color: msg === 'Saved.' ? E.green : E.red, marginLeft: 8 }}>{msg}</span>}
    </div>
  );
}

function AccountCard({ a, state, conn, onChanged }: { a: SetupEntry; state?: { connected: boolean; appReady: boolean }; conn?: Status['connections'][number]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const connectOauth = async () => {
    setBusy('connect'); setMsg('');
    const r = await api<{ url?: string }>(`/api/connect/oauth/start?provider=${a.id}`, { method: 'POST' });
    if (r.url) window.location.href = r.url; else { setMsg(r.error ?? 'Could not start.'); setBusy(''); }
  };
  const connectToken = async () => {
    setBusy('connect'); setMsg('');
    const r = await api<{ ok: boolean; detail: string }>('/api/connect/token', { body: { provider: a.id, values: vals } });
    setBusy(''); setMsg(r.error ?? r.detail); if (r.ok) setVals({}); onChanged();
  };
  const test = async () => { setBusy('test'); await api('/api/setup/test', { body: { provider: a.id } }); setBusy(''); onChanged(); };
  const disconnect = async () => { if (!(await askConfirm(`Disconnect ${a.name}?`))) return; await api('/api/connect/disconnect', { body: { provider: a.id } }); onChanged(); };
  return (
    <div style={{ ...E.card, padding: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: state?.connected ? (conn?.status === 'failed' ? E.red : E.green) : E.faint, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: E.text, flex: 1 }}>{a.name}</span>
        {a.phase && <Badge color={E.faint}>{a.phase}</Badge>}
        <span style={{ color: E.faint }}>{open ? '▾' : '▸'}</span>
      </div>
      <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}>{a.powers}</div>
      {a.unlocks && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>{a.unlocks.map((u) => <Badge key={u} color={E.violet}>{u}</Badge>)}</div>}
      <div style={{ marginTop: 6 }}>{state?.connected ? <TestLine conn={conn} /> : <Badge color={E.faint}>not connected</Badge>}</div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={label}>How to connect</div>
          <Steps e={a} />
          <div style={{ ...label, marginTop: 10 }}>Without it</div>
          <div style={{ fontSize: 'var(--text-body)', color: E.muted }}>{a.withoutIt}</div>
          {a.connect === 'token' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {a.fields.map((f) => <div key={f.secret}><div style={{ ...label, marginBottom: 4 }}>{f.label}</div><input style={field} type={f.secret === 'token' ? 'password' : 'text'} autoComplete="off" placeholder={f.placeholder} value={vals[f.secret] ?? ''} onChange={(e) => setVals({ ...vals, [f.secret]: e.target.value })} /></div>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {a.connect === 'oauth'
              ? <button style={btn('primary')} disabled={!!busy || !state?.appReady} onClick={connectOauth}>{busy === 'connect' ? 'Opening…' : state?.connected ? 'Reconnect' : 'Connect'}</button>
              : <button style={btn('primary')} disabled={!!busy || a.fields.some((f) => !vals[f.secret]?.trim())} onClick={connectToken}>{busy === 'connect' ? 'Testing…' : state?.connected ? 'Replace & test' : 'Connect & test'}</button>}
            {state?.connected && <button style={btn('ghost')} disabled={!!busy} onClick={test}>{busy === 'test' ? 'Testing…' : 'Test'}</button>}
            {state?.connected && <button style={btn('danger')} onClick={disconnect}>Disconnect</button>}
          </div>
          {a.connect === 'oauth' && !state?.appReady && <div style={{ fontSize: 'var(--text-caption)', color: E.amber, marginTop: 6 }}>Connect goes live once Mastermind's {a.name.split(' ')[0]} developer app keys are saved in Platform setup.</div>}
          {msg && <div style={{ fontSize: 'var(--text-caption)', color: msg.startsWith('Connected') ? E.green : E.red, marginTop: 6 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

/** "Start the company": creates the orchestrator and every module's worker
 *  pool at L0 with a daily cap per domain, and shows what loads. */
function StartCompany({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const pb = usePlaybooks();
  const [workers, setWorkers] = useState<{ domain: string; key: string; autonomy_level: number; enabled: boolean }[]>([]);
  const [caps, setCaps] = useState<{ id: string; domain: string; daily_cap_usd: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = async () => {
    const [w, c] = await Promise.all([supabase.from('ai_workers').select('domain,key,autonomy_level,enabled'), supabase.from('ai_domain_caps').select('id,domain,daily_cap_usd').order('domain')]);
    setWorkers((w.data ?? []) as typeof workers); setCaps((c.data ?? []) as typeof caps);
  };
  useEffect(() => { load(); }, []);
  const start = async () => { setBusy(true); const r = await startCompany(); setMsg(r.error ?? (r.anthropic ? 'The company is running. Every worker starts at L0 · Draft.' : 'Workers created — but the Anthropic key is missing, so none can run yet.')); setBusy(false); load(); };
  const started = workers.length > 0;
  const filled = pb.playbooks.filter((p) => p.body.trim()).length;
  const byDomain = (['ecom', 'content', 'marketing', 'all'] as const).map((d) => ({ d, list: WORKERS.filter((w) => w.domain === d) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.5 }}>Creates the orchestrator and every worker from the specs, loads the playbooks that exist, and sets a daily spend cap per module. Every worker starts at L0 · Draft — nothing it makes reaches a real person or spends money without your tap.</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btn('primary')} disabled={busy} onClick={start}>{busy ? 'Starting…' : started ? 'Re-sync workers' : 'Start the company'}</button>
        <Badge color={started ? E.green : E.faint}>{started ? `${workers.length} workers hired` : 'not started'}</Badge>
        <Badge color={filled ? E.green : E.amber}>{filled}/{pb.playbooks.length} playbooks written</Badge>
        <button style={{ ...btn('ghost'), fontSize: 12, padding: '5px 10px' }} onClick={() => onNavigate?.('playbooks')}>Open playbooks</button>
      </div>
      {msg && <div style={{ fontSize: 'var(--text-body)', color: msg.includes('missing') ? E.amber : E.green }}>{msg}</div>}
      {filled === 0 && <TeachingEmpty what="No playbooks written yet." worker="you — the orchestrator is only as good as the playbooks it loads. Workers run without them, on generic judgment." />}
      {caps.length > 0 && (
        <div style={{ ...E.card, padding: 12 }}>
          <div style={{ ...label, marginBottom: 6 }}>Daily cost cap per module</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{caps.map((c) => <CapField key={c.id} cap={c} onSaved={load} />)}</div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6 }}>When a module hits its cap, its workers stop for the day and an alert says so. Enforced in the Worker before every Claude call.</div>
        </div>
      )}
      {byDomain.map(({ d, list }) => (
        <div key={d}>
          <div style={{ ...label, marginBottom: 6 }}>{d === 'all' ? 'Shared' : d === 'ecom' ? 'E-commerce' : d === 'content' ? 'Content' : 'Marketing'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {list.map((w) => {
              const row = workers.find((x) => x.key === w.key && x.domain === w.domain);
              return (
                <div key={w.key} style={{ ...E.card, padding: 10, background: row ? E.surface : tint(E.faint, 6) }}>
                  <div style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-body)' }}>{w.name}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    <Badge color={E.blue}>{w.model}</Badge>
                    <Badge color={E.faint}>{AUTONOMY_LABEL[row?.autonomy_level ?? 0]}</Badge>
                    {row ? <Badge color={row.enabled ? E.green : E.faint}>{row.enabled ? 'hired' : 'off'}</Badge> : <Badge color={E.faint}>not hired</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CapField({ cap, onSaved }: { cap: { id: string; domain: string; daily_cap_usd: number }; onSaved: () => void }) {
  const [v, setV] = useState(String(cap.daily_cap_usd));
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 'var(--text-caption)', color: E.muted, minWidth: 64 }}>{cap.domain}</span>
      <span style={{ color: E.faint }}>$</span>
      <input style={{ ...field, width: 70, fontFamily: 'var(--font-mono)' }} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={async () => { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n !== Number(cap.daily_cap_usd)) { await supabase.from('ai_domain_caps').update({ daily_cap_usd: n, updated_at: new Date().toISOString() }).eq('id', cap.id); onSaved(); } }} />
      <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>/day</span>
    </div>
  );
}
