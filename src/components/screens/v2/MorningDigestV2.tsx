import { useEffect, useState } from 'react';
import { useDigest, localDate } from '../../../data/useDigest';
import type { BlockKind, ScheduleBlock } from '../../../data/useDigest';
import { api } from '../../../lib/api';
import { isPushSupported, subscribeToPush } from '../../../lib/push';
import { askConfirm } from '../../../lib/confirm';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Switch from '../../mm/Switch';
import { Page, Field, field, useModule } from '../../mm/Page';
import { Empty } from '../../mm/States';

interface Status { twilio: { sid: boolean; token: boolean; from: boolean; to: boolean }; anthropic: boolean; push: boolean; replyWebhook: string }
interface TestResult { body: string; length: number; polished: boolean; delivery: { channel: string; sent: boolean; error?: string }[]; desks: { desk: string; line: string; full: string; setUp: boolean }[]; twilio: boolean; error?: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KINDS: { id: BlockKind; label: string }[] = [
  { id: 'work', label: 'Work shift' }, { id: 'dials', label: 'Dial hour' }, { id: 'build', label: 'Build block' },
  { id: 'content', label: 'Content' }, { id: 'health', label: 'Health' }, { id: 'other', label: 'Other' },
];
const KIND_COLOR: Record<BlockKind, string> = { work: 'var(--text-tertiary)', dials: 'var(--success)', build: 'var(--accent)', content: 'var(--cat-2)', health: 'var(--cat-3)', other: 'var(--text-secondary)' };
const DESK_LABEL: Record<string, string> = { mbm: 'Made by Marq', mm: 'Mastermind', ecom: 'E-Com', content: 'Content', marketing: 'Marketing' };
const t12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const seg = (on: boolean) => ({ padding: '7px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? 'var(--text)' : 'var(--border)'}`, background: on ? 'var(--text)' : 'transparent', color: on ? 'var(--bg)' : 'var(--text-secondary)' });
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

/** Settings → Morning Digest: everything the morning text reads. */
export default function MorningDigestV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', two = !phone && !(device === 'ipad' && novaOpen);
  const d = useDigest();
  const [status, setStatus] = useState<Status | null>(null);
  const [day, setDay] = useState(() => new Date().getDay());
  const [test, setTest] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState<'send' | 'preview' | null>(null);
  const [pushState, setPushState] = useState('');
  useEffect(() => { api<Status>('/api/digest/status').then((s) => { if (!s.error) setStatus(s); }); }, []);
  const run = async (send: boolean) => { setBusy(send ? 'send' : 'preview'); setTest(null); const r = await api<TestResult>(`/api/digest/test${send ? '' : '?send=0'}`, { method: 'POST' }); setTest(r); setBusy(null); d.reload(); };
  const sms = !!status && Object.values(status.twilio).every(Boolean);
  const s = d.settings;
  const dayBlocks = d.blocks.filter((b) => b.day_of_week === day);

  const delivery = (
    <Card title="Delivery" meta={s ? `Every day at ${t12(s.send_time)}` : undefined}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip k={sms ? 'good' : 'warn'}>{sms ? 'Text ready' : 'Text not set up'}</Chip>
        <Chip k={status?.push ? 'good' : 'warn'}>{status?.push ? 'Push ready' : 'Push keys missing'}</Chip>
        <Chip k={status?.anthropic ? 'good' : 'neutral'}>{status?.anthropic ? 'AI ranks the lines' : 'AI off: plain draft'}</Chip>
      </div>
      {status && !sms && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Until texting is set up the digest arrives as a push notification. Missing Worker secrets: {Object.entries(status.twilio).filter(([, v]) => !v).map(([k]) => ({ sid: 'TWILIO_ACCOUNT_SID', token: 'TWILIO_AUTH_TOKEN', from: 'TWILIO_FROM_NUMBER', to: 'DIGEST_TO_NUMBER' }[k])).join(', ')}. Setup has the steps.</p>}
      {isPushSupported() && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="mm-btn" onClick={async () => { setPushState('…'); const ok = await subscribeToPush(); setPushState(ok ? 'This device will get the digest.' : 'Could not turn on push here. On iPhone, add the app to your home screen first.'); }}>Turn on push for this device</button>
          {pushState && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{pushState}</span>}
        </div>
      )}
      {status && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>Reply webhook: <span style={mono}>{status.replyWebhook}</span></span>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
        <button className="mm-btn mm-btn--primary" disabled={!!busy} onClick={() => run(true)}>{busy === 'send' ? 'Sending…' : 'Send test now'}</button>
        <button className="mm-btn" disabled={!!busy} onClick={() => run(false)}>{busy === 'preview' ? 'Building…' : 'Preview'}</button>
      </div>
    </Card>
  );
  const preview = test && (
    <Card title="Preview" meta={test.error ? undefined : `${test.length} / 600 characters`}>
      {test.error ? <span style={{ color: 'var(--danger)' }}>{test.error}</span> : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {test.polished && <Chip k="accent">Ranked by AI</Chip>}
            {test.delivery.map((x, i) => <Chip key={i} k={x.sent ? 'good' : 'bad'} title={x.error}>{x.channel}: {x.sent ? 'sent' : 'not sent'}</Chip>)}
          </div>
          <pre style={{ ...mono, margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, color: 'var(--text)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>{test.body}</pre>
          {test.delivery.filter((x) => !x.sent && x.error).map((x, i) => <span key={i} style={{ fontSize: 13, color: 'var(--warning)' }}>{x.channel}: {x.error}</span>)}
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)' }}>Desk reports (what replying with the desk code returns)</summary>
            {test.desks.map((x) => <div key={x.desk} style={{ marginTop: 10 }}><div style={{ color: 'var(--text)', fontSize: 14.5, fontWeight: 600 }}>{DESK_LABEL[x.desk] ?? x.desk} {!x.setUp && <Chip k="neutral">Not set up</Chip>}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{x.full}</div></div>)}
          </details>
        </>
      )}
    </Card>
  );
  const week = (
    <Card title="Your standing week" meta="The digest's first lines">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{DAYS.map((n, i) => <button key={n} onClick={() => setDay(i)} style={seg(day === i)}>{n} <span style={{ opacity: 0.6 }}>{d.blocks.filter((b) => b.day_of_week === i).length}</span></button>)}</div>
      {!d.loading && d.blocks.length === 0 && <Empty text="No schedule blocks yet. Add your work shift, dial hour and build block for each day." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{dayBlocks.map((b) => <BlockRow key={b.id} b={b} onSave={(p) => d.updateBlock(b.id, p)} onRemove={() => d.removeBlock(b.id)} />)}</div>
      <NewBlock day={day} onAdd={(b) => d.addBlock(b)} />
      {dayBlocks.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="mm-btn" style={{ height: 34, fontSize: 13 }} onClick={async () => { if (await askConfirm(`Copy ${DAYS[day]} onto Mon–Fri? Their current blocks are replaced.`)) d.copyDay(day, [1, 2, 3, 4, 5].filter((x) => x !== day)); }}>Copy to weekdays</button>
          <button className="mm-btn" style={{ height: 34, fontSize: 13 }} onClick={async () => { if (await askConfirm(`Copy ${DAYS[day]} onto every other day?`)) d.copyDay(day, [0, 1, 2, 3, 4, 5, 6].filter((x) => x !== day)); }}>Copy to all days</button>
        </div>
      )}
    </Card>
  );
  const targets = (
    <Card title="Targets" meta="What yesterday is measured against">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>{d.targets.map((t) => <TargetField key={t.id} label={`${t.label} / ${t.period}`} value={t.target} onSave={(v) => d.saveTarget(t.id, v)} />)}</div>
    </Card>
  );
  const today = <Card title="Today's numbers" meta={`${localDate()} · or text "dials 30" back`}><LogForm log={d.log} onSave={d.saveLog} /></Card>;
  const settings = s && (
    <Card title="Settings">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ color: 'var(--text)', fontSize: 15 }}>Send every morning</span><Switch on={s.enabled} onChange={(v) => d.saveSettings({ enabled: v })} label="Send every morning" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        <Field l="Send time"><input type="time" value={s.send_time.slice(0, 5)} onChange={(e) => e.target.value && d.saveSettings({ send_time: e.target.value })} style={field} /></Field>
        <Field l="Time zone"><select value={s.timezone} onChange={(e) => d.saveSettings({ timezone: e.target.value })} style={field}>{['America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Chicago', 'America/New_York'].map((z) => <option key={z} value={z}>{z.replace('America/', '').replace('_', ' ')}</option>)}</select></Field>
        <Field l="Channel"><select value={s.channel} onChange={(e) => d.saveSettings({ channel: e.target.value as 'sms' | 'push' | 'both' })} style={field}><option value="both">Text + push</option><option value="sms">Text (push if it fails)</option><option value="push">Push only</option></select></Field>
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Desks in the digest</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.keys(DESK_LABEL).map((k) => { const on = s.desks?.[k] !== false; return <button key={k} onClick={() => d.saveSettings({ desks: { ...s.desks, [k]: !on } })} style={seg(on)}>{DESK_LABEL[k]}</button>; })}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--text)', fontSize: 15 }}>Also text each desk's full report</span><Switch on={s.separate_texts} onChange={(v) => d.saveSettings({ separate_texts: v })} label="Separate desk texts" /></div>
      <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Last sent: {s.last_sent_date ?? 'never'} · Daylight saving is handled automatically.</span>
    </Card>
  );
  const sends = d.sends.length > 0 && (
    <Card title="Recent sends" flush>
      <div style={{ paddingBottom: 6 }}>{d.sends.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', minWidth: 110 }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          <Chip k={r.status === 'sent' ? 'good' : r.status === 'preview' ? 'neutral' : 'bad'}>{r.kind} · {r.status}</Chip>
          {r.channel && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.channel}</span>}
          {r.error && <span style={{ fontSize: 13, color: 'var(--warning)' }}>{r.error}</span>}
        </div>
      ))}</div>
    </Card>
  );
  return (
    <Page title="Morning Digest" sub={`One text at ${s ? t12(s.send_time) : '5:30 AM'}: your day, yesterday against target, the #1 thing, one line per desk`} back="Settings" backTo="account-settings">
      {d.error && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{d.error}</span>}
      {two ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{delivery}{preview}{week}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{today}{targets}{settings}{sends}</div>
        </div>
      ) : <>{delivery}{preview}{today}{week}{targets}{settings}{sends}</>}
    </Page>
  );
}

function BlockRow({ b, onSave, onRemove }: { b: ScheduleBlock; onSave: (p: Partial<ScheduleBlock>) => void; onRemove: () => void }) {
  const [text, setText] = useState(b.label);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto minmax(0,1fr) auto', gap: 6, alignItems: 'center', padding: 10, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: `3px solid ${KIND_COLOR[b.kind]}` }}>
      <input type="time" aria-label="Start" value={b.start_time.slice(0, 5)} onChange={(e) => e.target.value && onSave({ start_time: e.target.value })} style={{ ...field, width: 110, height: 38, fontSize: 14 }} />
      <input type="time" aria-label="End" value={b.end_time.slice(0, 5)} onChange={(e) => e.target.value && onSave({ end_time: e.target.value })} style={{ ...field, width: 110, height: 38, fontSize: 14 }} />
      <input aria-label="Label" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() && text !== b.label && onSave({ label: text.trim() })} style={{ ...field, height: 38, fontSize: 14 }} />
      <button className="mm-icon-btn" aria-label="Remove block" onClick={onRemove} style={{ width: 34, height: 34 }}>×</button>
      <select aria-label="Kind" value={b.kind} onChange={(e) => onSave({ kind: e.target.value as BlockKind })} style={{ ...field, height: 36, fontSize: 13.5, gridColumn: '1 / -1' }}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
    </div>
  );
}

function NewBlock({ day, onAdd }: { day: number; onAdd: (b: Omit<ScheduleBlock, 'id' | 'active'>) => void }) {
  const [start, setStart] = useState('16:00'); const [end, setEnd] = useState('17:00'); const [text, setText] = useState(''); const [kind, setKind] = useState<BlockKind>('dials');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, border: '1px dashed var(--border)', background: 'var(--accent-wash)' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="time" aria-label="New block start" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...field, height: 38, fontSize: 14 }} />
        <input type="time" aria-label="New block end" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...field, height: 38, fontSize: 14 }} />
        <select aria-label="New block kind" value={kind} onChange={(e) => setKind(e.target.value as BlockKind)} style={{ ...field, height: 38, fontSize: 13.5 }}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input aria-label="New block label" value={text} onChange={(e) => setText(e.target.value)} placeholder="35 dials · Work · Build: invoice page" style={{ ...field, height: 38, fontSize: 14 }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 38, flex: 'none' }} disabled={!text.trim() || !start || !end} onClick={() => { onAdd({ day_of_week: day, start_time: start, end_time: end, label: text.trim(), kind }); setText(''); }}>Add to {DAYS[day]}</button>
      </div>
    </div>
  );
}

function TargetField({ label: l, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return <Field l={l}><input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n !== value) onSave(n); }} style={field} /></Field>;
}

function LogForm({ log, onSave }: { log: ReturnType<typeof useDigest>['log']; onSave: (p: Record<string, number | string | null>) => void }) {
  const fields: { k: 'dials' | 'conversations' | 'meetings' | 'inbound_leads' | 'posts' | 'cash_in'; l: string }[] = [
    { k: 'dials', l: 'Dials' }, { k: 'conversations', l: 'Conversations' }, { k: 'meetings', l: 'Meetings' }, { k: 'inbound_leads', l: 'Inbound' }, { k: 'posts', l: 'Posts' }, { k: 'cash_in', l: 'Cash in $' },
  ];
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { setVals(Object.fromEntries(fields.map((f) => [f.k, log?.[f.k] != null ? String(log[f.k]) : '']))); }, [log]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {fields.map((f) => <Field key={f.k} l={f.l}><input inputMode="decimal" value={vals[f.k] ?? ''} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} style={field} /></Field>)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="mm-btn mm-btn--primary" onClick={() => onSave(Object.fromEntries(fields.map((f) => [f.k, vals[f.k]?.trim() ? Number(vals[f.k]) : null])))}>Save today</button>
        {log?.top_done && <Chip k="good">#1 done today</Chip>}
      </div>
    </>
  );
}
