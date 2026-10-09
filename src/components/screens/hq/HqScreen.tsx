import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Page, Tabs, Field, field } from '../../mm/Page';
import { useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import Chip from '../../mm/Chip';
import Switch from '../../mm/Switch';
import FlagDot from '../../mm/FlagDot';
import Thumbs from '../../mm/Thumbs';
import { Empty } from '../../mm/States';
import { usd } from '../v2/util';
import { useFlags } from '../../../data/useFlags';

// HQ (October brief §5.8): the master orchestrator's home. One place for
// the morning report, the chat that routes to the domain orchestrators,
// everything waiting on Marq across portals, open flags, spend vs caps,
// the kill switch, and the task log.

type Controls = { paused_all: boolean; paused_ecommerce: boolean; paused_content: boolean; paused_marketing: boolean; per_action_approval_over_usd: number; monthly_caps: Record<string, number>; stores_per_product: number };
interface Status {
  date: string; controls: Controls;
  flags: { id: string; domain: string; entity_type: string; entity_id: string; severity: 'red' | 'amber'; rule: string; message: string; link: string | null; opened_at: string }[];
  approvals: { id: string; domain: string; type: string; title: string; is_money: boolean; amount_usd: number | null; created_at: string }[];
  report: { date: string; summary_text: string } | null;
  summaries: { domain: string; summary_text: string; numbers: Record<string, unknown> }[];
  handoffs: { id: string; from_domain: string; to_domain: string; kind: string; status: string; note: string | null; created_at: string }[];
  tasks: { id: string; domain: string; body: string; instructions: string | null; status: string; note: string | null; created_at: string }[];
  runs: { id: string; worker_id: string | null; domain: string; status: string; summary: string | null; error: string | null; cost_usd: number; trigger: string; created_at: string }[];
  spend: { daily: { domain: string; spent: number; cap: number }[]; monthly: { bucket: string; cap: number; spent: number }[] };
}
type Tab = 'today' | 'flags' | 'spend' | 'log' | 'texting';
const DOMAIN: Record<string, string> = { ecom: 'E-commerce', ecommerce: 'E-commerce', content: 'Content', marketing: 'Marketing', master: 'HQ', madeby: 'Made by', personal: 'Personal', 'orch:ecom': 'E-commerce', 'orch:content': 'Content', 'orch:marketing': 'Marketing' };
const LINK_SCREEN: Record<string, string> = { approvals: 'ecom-inbox', office: 'ecom-office', stores: 'ecom-stores', content: 'content', setup: 'setup', hq: 'hq' };
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

export function useHqStatus() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { const r = await api<Status>('/api/hq/status'); if (r.error) setErr(r.error); else { setS(r); setErr(''); } }, []);
  useEffect(() => { void load(); }, [load]);
  return { s, err, load };
}

export default function HqScreen() {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const { s, err, load } = useHqStatus();
  const flagsApi = useFlags(true);
  const [tab, setTab] = useState<Tab>('today');
  const reds = s?.flags.filter((f) => f.severity === 'red').length ?? 0;
  return (
    <Page title="HQ" sub="The master orchestrator: one report, one place to talk, one kill switch" back="Made by" backTo="client-modules">
      {err && <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid color-mix(in srgb, var(--warning) 40%, var(--border))', background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))', fontSize: 14 }}>{err}</div>}
      {s && <KillSwitch controls={s.controls} onChanged={() => { void load(); void flagsApi.reload(); }} />}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'today', label: 'Today' }, { id: 'flags', label: 'Flags', badge: reds }, { id: 'spend', label: 'Spend & limits' }, { id: 'log', label: 'Task log' }, { id: 'texting', label: 'Texting line' }]} />
      {!s && !err && <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading HQ…</div>}
      {s && tab === 'today' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4,minmax(0,1fr))', gap: phone ? 10 : 16 }}>
            <Stat label="Red flags" value={String(reds)} pill={reds ? 'fix first' : 'all clear'} k={reds ? 'bad' : 'good'} onClick={() => setTab('flags')} />
            <Stat label="Amber" value={String(s.flags.length - reds)} pill="watch" k={s.flags.length - reds ? 'warn' : 'neutral'} onClick={() => setTab('flags')} />
            <Stat label="Waiting on you" value={String(s.approvals.length)} pill={`${s.approvals.filter((a) => a.is_money).length} money`} k={s.approvals.length ? 'warn' : 'neutral'} />
            <Stat label="AI spend today" value={usd(s.spend.daily.reduce((x, d) => x + d.spent, 0), 2)} pill={`of ${usd(s.spend.daily.reduce((x, d) => x + d.cap, 0), 0)}`} onClick={() => setTab('spend')} />
          </div>
          <Card title="Morning report" meta={s.report ? s.report.date : 'not written yet'}>
            {s.report ? <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{s.report.summary_text}</p> : <Empty text="HQ writes the report after the overnight plan (about 7:00 Denver). It reads every domain orchestrator, the flags and spend." />}
            {s.report && <div style={{ marginTop: 10 }}><Thumbs entityType="hq_report" entityId={s.report.date} domain="master" compact /></div>}
          </Card>
          <HqChat onRouted={load} />
          {s.summaries.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(3,minmax(0,1fr))', gap: 16 }}>
              {s.summaries.map((x) => <Card key={x.domain} title={DOMAIN[x.domain] ?? x.domain} meta="last night"><p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{x.summary_text}</p></Card>)}
            </div>
          )}
          <Card title="Waiting on you" meta={`${s.approvals.length} across every portal`} flush>
            {s.approvals.length === 0 ? <div style={{ padding: '4px 0 12px', color: 'var(--text-secondary)', fontSize: 14 }}>Nothing to approve.</div> : s.approvals.slice(0, 30).map((a, i) => (
              <button key={a.id} onClick={() => nav(a.domain === 'content' ? 'content' : a.domain === 'marketing' ? 'marketing' : 'ecom-inbox')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', border: 0, borderTop: i ? '1px solid var(--grid)' : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                <FlagDot flag={flagsApi.flagFor('approval', a.id)} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</span>
                <Chip k={a.is_money ? 'warn' : 'neutral'}>{DOMAIN[a.domain] ?? a.domain}{a.is_money && a.amount_usd != null ? ` · ${usd(a.amount_usd, 2)}` : ''}</Chip>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 34, textAlign: 'right' }}>{ago(a.created_at)}</span>
              </button>
            ))}
          </Card>
          {s.handoffs.length > 0 && (
            <Card title="Handoffs between orchestrators" flush>
              {s.handoffs.map((h, i) => <div key={h.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1 }}>{DOMAIN[h.from_domain] ?? h.from_domain} → {DOMAIN[h.to_domain] ?? h.to_domain}: {h.kind.replace(/_/g, ' ')}{h.note ? ` — ${h.note}` : ''}</span><Chip k={h.status === 'done' ? 'good' : h.status === 'failed' ? 'bad' : 'accent'}>{h.status}</Chip></div>)}
            </Card>
          )}
        </>
      )}
      {s && tab === 'flags' && <FlagList flags={s.flags} onOpen={(l) => nav(LINK_SCREEN[l] ?? 'hq')} onSync={async () => { await api('/api/hq/flags-sync', { body: {} }); await load(); await flagsApi.reload(); }} />}
      {s && tab === 'spend' && <SpendLimits s={s} onSaved={load} />}
      {s && tab === 'log' && <TaskLog s={s} />}
      {tab === 'texting' && <TextingLine />}
    </Page>
  );
}

export function KillSwitch({ controls, onChanged }: { controls: Controls; onChanged: () => void }) {
  const [busy, setBusy] = useState('');
  const flip = async (which: string, paused: boolean) => {
    if (paused && !window.confirm(which === 'all' ? 'Pause everything? No worker runs, posts, texts or spend until you resume. Queued work waits, nothing is lost.' : `Pause ${which}?`)) return;
    setBusy(which); await api('/api/hq/pause', { body: { which, paused } }); setBusy(''); onChanged();
  };
  const all = controls.paused_all;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '14px 16px', borderRadius: 14, border: `1px solid ${all ? 'color-mix(in srgb, var(--danger) 45%, var(--border))' : 'var(--border)'}`, background: all ? 'color-mix(in srgb, var(--danger) 9%, var(--surface))' : 'var(--surface)' }}>
      <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: all ? 'var(--danger)' : 'var(--text)' }}>{all ? 'Everything is paused' : 'Kill switch'}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{all ? 'No runs, posts, texts or spend. Queued work resumes when you switch it back on.' : 'Stops every worker, post, text and spend at once. Nothing is lost.'}</span>
      </div>
      <button className={`mm-btn ${all ? 'mm-btn--primary' : ''}`} disabled={!!busy} onClick={() => void flip('all', !all)} style={{ height: 44, padding: '0 18px', fontWeight: 600, color: all ? undefined : 'var(--danger)', borderColor: all ? undefined : 'color-mix(in srgb, var(--danger) 45%, var(--border))' }}>{busy === 'all' ? '…' : all ? 'Resume everything' : 'Pause everything'}</button>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {(['ecommerce', 'content', 'marketing'] as const).map((k) => <Switch key={k} label={`${k === 'ecommerce' ? 'E-commerce' : k[0].toUpperCase() + k.slice(1)} running`} on={!controls[`paused_${k}`]} disabled={all || !!busy} onChange={(on) => void flip(k, !on)} />)}
      </div>
    </div>
  );
}

function HqChat({ onRouted }: { onRouted: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ me: string; reply: string; domain: string | null }[]>([]);
  const send = async () => {
    const t = text.trim(); if (!t) return;
    setBusy(true); setText('');
    const r = await api<{ reply?: string; domain?: string | null; routed?: { reply?: string; worker?: string } }>('/api/hq/chat', { body: { text: t } });
    setBusy(false);
    setLog((l) => [...l, { me: t, reply: r.error ?? [r.reply, r.routed?.worker ? `→ ${r.routed.worker}: ${r.routed.reply ?? ''}` : ''].filter(Boolean).join(' '), domain: r.domain ?? null }]);
    onRouted();
  };
  return (
    <Card title="Talk to HQ" meta="it routes to the right orchestrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {log.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '8px 12px', borderRadius: 12, background: 'var(--surface-2)', fontSize: 14 }}>{m.me}</div>
            <div style={{ maxWidth: '90%', padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, lineHeight: 1.5 }}>{m.domain && <Chip k="accent">{DOMAIN[m.domain]}</Chip>} {m.reply}</div>
            <Thumbs entityType="hq_message" entityId={`${Date.now()}-${i}`} domain="master" compact />
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="“Find me a product under $40 that ships from the US”" style={{ ...field, flex: 1 }} />
          <button className="mm-btn mm-btn--primary" disabled={busy || !text.trim()} style={{ height: 44, padding: '0 16px' }}>{busy ? '…' : 'Send'}</button>
        </form>
      </div>
    </Card>
  );
}

function FlagList({ flags, onOpen, onSync }: { flags: Status['flags']; onOpen: (link: string) => void; onSync: () => void }) {
  if (!flags.length) return <Card title="Flags"><Empty text="Nothing is broken, stalled or waiting too long." cta="Check again now" onCta={onSync} /></Card>;
  const groups = [...new Set(flags.map((f) => f.domain))];
  return (
    <>
      <div><button className="mm-btn" style={{ height: 36, fontSize: 13 }} onClick={onSync}>Recheck now</button></div>
      {groups.map((g) => (
        <Card key={g} title={DOMAIN[g] ?? g} meta={`${flags.filter((f) => f.domain === g && f.severity === 'red').length} red`} flush>
          {flags.filter((f) => f.domain === g).map((f, i) => (
            <button key={f.id} onClick={() => onOpen(f.link ?? 'hq')} style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', border: 0, borderTop: i ? '1px solid var(--grid)' : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
              <FlagDot flag={f} />
              <span style={{ flex: 1, fontSize: 14.5 }}>{f.message}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ago(f.opened_at)}</span>
            </button>
          ))}
        </Card>
      ))}
    </>
  );
}

function SpendLimits({ s, onSaved }: { s: Status; onSaved: () => void }) {
  const [per, setPer] = useState(String(s.controls.per_action_approval_over_usd));
  const [caps, setCaps] = useState<Record<string, string>>(Object.fromEntries(Object.entries(s.controls.monthly_caps).map(([k, v]) => [k, String(v)])));
  const [stores, setStores] = useState(String(s.controls.stores_per_product));
  const [msg, setMsg] = useState('');
  const bar = (spent: number, cap: number) => { const pct = cap > 0 ? Math.min(1, spent / cap) : 0; const c = pct >= 1 ? 'var(--danger)' : pct >= 0.8 ? 'var(--warning)' : 'var(--accent)'; return <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}><div className="mm-grow" style={{ width: `${pct * 100}%`, height: '100%', background: c, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} /></div>; };
  return (
    <>
      <Card title="AI spend today" meta="per-domain daily caps">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{s.spend.daily.map((d) => <div key={d.domain} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>{DOMAIN[d.domain] ?? d.domain}</span><span style={{ color: 'var(--text-secondary)' }}>{usd(d.spent, 2)} of {usd(d.cap, 2)}</span></div>{bar(d.spent, d.cap)}</div>)}</div>
      </Card>
      <Card title="This month's spend" meta="the Finance/Guardrail worker blocks anything over a cap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{s.spend.monthly.map((d) => <div key={d.bucket} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ textTransform: 'capitalize' }}>{d.bucket}</span><span style={{ color: 'var(--text-secondary)' }}>{usd(d.spent, 2)} of {usd(d.cap, 0)}</span></div>{bar(d.spent, d.cap)}</div>)}</div>
      </Card>
      <Card title="Limits">
        <div style={{ display: 'grid', gap: 12 }}>
          <Field l="Any single money move over this needs your approval ($)"><input inputMode="decimal" value={per} onChange={(e) => setPer(e.target.value)} style={field} /></Field>
          {Object.keys(caps).map((k) => <Field key={k} l={`Monthly cap — ${k} ($)`}><input inputMode="decimal" value={caps[k]} onChange={(e) => setCaps({ ...caps, [k]: e.target.value })} style={field} /></Field>)}
          <Field l="Sites per approved product (1 recommended; 2 only to A/B test two brand directions, all on the same Shopify store)"><select value={stores} onChange={(e) => setStores(e.target.value)} style={field}><option value="1">1</option><option value="2">2</option></select></Field>
          <button className="mm-btn mm-btn--primary" style={{ height: 46 }} onClick={async () => { const r = await api('/api/hq/settings', { body: { per_action_approval_over_usd: Number(per), monthly_caps: Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, Number(v)])), stores_per_product: Number(stores) } }); setMsg(r.error ?? 'Saved.'); onSaved(); }}>Save limits</button>
          {msg && <span style={{ fontSize: 13, color: msg === 'Saved.' ? 'var(--success)' : 'var(--danger)' }}>{msg}</span>}
        </div>
      </Card>
    </>
  );
}

function TaskLog({ s }: { s: Status }) {
  const [filter, setFilter] = useState<'all' | 'failed'>('all');
  const rows = [
    ...s.tasks.map((t) => ({ id: `t${t.id}`, at: t.created_at, what: t.instructions ?? t.body, result: t.note ?? '', status: t.status, cost: null as number | null, domain: t.domain })),
    ...s.runs.map((r) => ({ id: `r${r.id}`, at: r.created_at, what: r.summary ?? `${r.trigger} run`, result: r.error ?? '', status: r.status, cost: Number(r.cost_usd), domain: r.domain })),
  ].sort((a, b) => b.at.localeCompare(a.at)).filter((r) => filter === 'all' || r.status === 'failed');
  return (
    <Card title="Everything the orchestrators and workers did" meta="newest first" flush action={<select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'failed')} style={{ ...field, height: 32, width: 'auto', fontSize: 13 }}><option value="all">All</option><option value="failed">Failed only</option></select>}>
      {rows.length === 0 ? <div style={{ padding: '4px 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>Nothing logged yet.</div> : rows.slice(0, 120).map((r, i) => (
        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 13.5, alignItems: 'start' }}>
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{new Date(r.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          <span style={{ minWidth: 0 }}><span style={{ color: 'var(--text)' }}>{r.what}</span>{r.result && <span style={{ display: 'block', color: r.status === 'failed' ? 'var(--danger)' : 'var(--text-secondary)', marginTop: 2 }}>{r.result}</span>}</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{r.cost != null && r.cost > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{usd(r.cost, 3)}</span>}<Chip k={r.status === 'done' ? 'good' : r.status === 'failed' ? 'bad' : 'neutral'}>{r.status}</Chip></span>
        </div>
      ))}
    </Card>
  );
}

/** The two-way texting line (Twilio + Grok): its voice and every text in and out. */
function TextingLine() {
  const [d, setD] = useState<{ settings: { enabled: boolean; mode: string; system_prompt: string | null }; defaults: Record<string, string>; provider: string; log: { id: string; direction: string; counterpart: string; body: string; status: string; error: string | null; dry_run: boolean; created_at: string }[] } | null>(null);
  const [mode, setMode] = useState('lead_response');
  const [prompt, setPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const r = await api<NonNullable<typeof d>>('/api/sms/settings'); if (r.error) { setMsg(r.error); return; } setD(r); setMode(r.settings.mode); setPrompt(r.settings.system_prompt ?? ''); setEnabled(r.settings.enabled); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!d) return <Card title="Texting line">{msg || 'Loading…'}</Card>;
  const threads = [...new Set(d.log.map((m) => m.counterpart))];
  return (
    <>
      <Card title="Texting line" meta={`replies with ${d.provider === 'grok' ? 'Grok (xAI)' : 'Claude'}`}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 14 }}>Auto-reply to texts that aren\'t digest commands</span><Switch label="Auto-reply" on={enabled} onChange={setEnabled} /></div>
          <Field l="Mode"><select value={mode} onChange={(e) => setMode(e.target.value)} style={field}><option value="lead_response">Lead response (book a call with Marq)</option><option value="support">Masterminds support</option><option value="custom">Custom prompt</option></select></Field>
          <Field l={mode === 'custom' ? 'Your prompt' : 'The prompt it uses'}>
            <textarea value={mode === 'custom' ? prompt : d.defaults[mode] ?? ''} readOnly={mode !== 'custom'} onChange={(e) => setPrompt(e.target.value)} style={{ ...field, height: 150, padding: '10px 12px', lineHeight: 1.45, resize: 'vertical', opacity: mode === 'custom' ? 1 : 0.75 }} />
          </Field>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="mm-btn mm-btn--primary" style={{ height: 44, padding: '0 18px' }} onClick={async () => { const r = await api('/api/sms/settings', { body: { enabled, mode, system_prompt: mode === 'custom' ? prompt : null } }); setMsg(r.error ?? 'Saved.'); }}>Save</button>{msg && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</span>}</div>
        </div>
      </Card>
      <Card title="Every text" meta={`${threads.length} conversation${threads.length === 1 ? '' : 's'}`} flush>
        {d.log.length === 0 ? <div style={{ padding: '4px 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>No texts yet. Point the Twilio number's incoming-message webhook at /api/sms/inbound (Setup → Twilio).</div> : d.log.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14, alignItems: 'flex-start' }}>
            <Chip k={m.direction === 'in' ? 'accent' : 'neutral'}>{m.direction === 'in' ? 'In' : 'Out'}</Chip>
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{m.counterpart} · {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{m.dry_run ? ' · dry run' : ''}</span><span style={{ display: 'block', color: 'var(--text)' }}>{m.body}</span>{m.error && <span style={{ display: 'block', color: 'var(--danger)', fontSize: 12.5 }}>{m.error}</span>}</span>
          </div>
        ))}
      </Card>
    </>
  );
}
