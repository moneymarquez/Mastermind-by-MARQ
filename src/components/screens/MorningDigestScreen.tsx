import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDigest, localDate } from '../../data/useDigest';
import type { BlockKind, ScheduleBlock } from '../../data/useDigest';
import { api } from '../../lib/api';
import { isPushSupported, subscribeToPush } from '../../lib/push';
import { E, Badge, Pill, Section, TeachingEmpty, btn, field, label, panel, tint } from './ecom/ecomShared';
import { askConfirm } from '../../lib/confirm';

interface Props { homeHeadStyle: CSSProperties; homeSubStyle: CSSProperties }

interface Status { twilio: { sid: boolean; token: boolean; from: boolean; to: boolean }; anthropic: boolean; push: boolean; replyWebhook: string }
interface TestResult { body: string; length: number; polished: boolean; delivery: { channel: string; sent: boolean; error?: string }[]; desks: { desk: string; line: string; full: string; setUp: boolean }[]; twilio: boolean; error?: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KINDS: { id: BlockKind; label: string }[] = [
  { id: 'work', label: 'Work shift' }, { id: 'dials', label: 'Dial hour' }, { id: 'build', label: 'Build block' },
  { id: 'content', label: 'Content' }, { id: 'health', label: 'Health' }, { id: 'other', label: 'Other' },
];
const KIND_COLOR: Record<BlockKind, string> = { work: E.faint, dials: E.green, build: E.accent, content: E.violet, health: E.teal, other: E.muted };
const DESK_LABEL: Record<string, string> = { mbm: 'Made by Marq', mm: 'Mastermind', ecom: 'E-Com', content: 'Content', marketing: 'Marketing' };
const t12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; };

/** Morning Digest settings (Appendix 4, Part C1 + the Send test button).
 *  Everything the 5:30am text reads is editable here: your standing week,
 *  the targets it measures against, today's numbers, and how it reaches you. */
export default function MorningDigestScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const d = useDigest();
  const [status, setStatus] = useState<Status | null>(null);
  const [day, setDay] = useState(() => new Date().getDay());
  const [test, setTest] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState<'send' | 'preview' | null>(null);
  const [pushState, setPushState] = useState('');

  useEffect(() => { api<Status>('/api/digest/status').then((s) => { if (!s.error) setStatus(s); }); }, []);

  const run = async (send: boolean) => {
    setBusy(send ? 'send' : 'preview'); setTest(null);
    const r = await api<TestResult>(`/api/digest/test${send ? '' : '?send=0'}`, { method: 'POST' });
    setTest(r); setBusy(null); d.reload();
  };

  const twilioReady = !!status && Object.values(status.twilio).every(Boolean);
  const s = d.settings;
  const dayBlocks = d.blocks.filter((b) => b.day_of_week === day);

  return (
    <div>
      <div style={homeHeadStyle}>Morning Digest</div>
      <div style={homeSubStyle}>One text at {s ? t12(s.send_time) : '5:30am'}: your day, yesterday against target, the #1 thing, one line per desk.</div>

      <div style={{ ...panel, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {d.error && <div style={{ color: E.red, fontSize: 'var(--text-body)' }}>{d.error}</div>}

        {/* How it reaches you — honest about what is and isn't wired. */}
        <div style={{ ...E.card, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={label}>Delivery</span>
            <Badge color={twilioReady ? E.green : E.amber}>{twilioReady ? 'SMS ready' : 'SMS not set up'}</Badge>
            <Badge color={status?.push ? E.green : E.amber}>{status?.push ? 'Push ready' : 'Push keys missing'}</Badge>
            <Badge color={status?.anthropic ? E.green : E.amber}>{status?.anthropic ? 'Claude connected' : 'No Claude key — plain draft'}</Badge>
          </div>
          {status && !twilioReady && (
            <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 8, lineHeight: 1.5 }}>
              Until Twilio's toll-free verification clears, the digest comes as a push notification from this app. Missing Worker secrets: {Object.entries(status.twilio).filter(([, v]) => !v).map(([k]) => ({ sid: 'TWILIO_ACCOUNT_SID', token: 'TWILIO_AUTH_TOKEN', from: 'TWILIO_FROM_NUMBER', to: 'DIGEST_TO_NUMBER' }[k])).join(', ')}. Setup has the click-by-click.
            </div>
          )}
          {isPushSupported() && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <button style={btn('ghost')} onClick={async () => { setPushState('…'); const ok = await subscribeToPush(); setPushState(ok ? 'This device will get the digest.' : 'Could not turn on push here. On iPhone, add Mastermind to your home screen first.'); }}>Turn on push for this device</button>
              {pushState && <span style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{pushState}</span>}
            </div>
          )}
          {status && <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 8 }}>Twilio reply webhook: <span style={{ fontFamily: 'var(--font-mono)', color: E.muted, wordBreak: 'break-all' }}>{status.replyWebhook}</span></div>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn('primary')} disabled={!!busy} onClick={() => run(true)}>{busy === 'send' ? 'Sending…' : 'Send test now'}</button>
          <button style={btn('ghost')} disabled={!!busy} onClick={() => run(false)}>{busy === 'preview' ? 'Building…' : 'Preview without sending'}</button>
        </div>

        {test && (
          <div style={{ ...E.card, padding: 14 }}>
            {test.error ? <div style={{ color: E.red }}>{test.error}</div> : (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                  <span style={label}>{test.length} / 600 chars</span>
                  {test.polished && <Badge color={E.violet}>ranked by Claude</Badge>}
                  {test.delivery.map((x, i) => <Badge key={i} color={x.sent ? E.green : E.red} title={x.error}>{x.channel}: {x.sent ? 'sent' : 'not sent'}</Badge>)}
                </div>
                <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0, color: E.text, background: E.sunk, border: `1px solid ${E.border}`, borderRadius: 'var(--radius-sm)', padding: 12 }}>{test.body}</pre>
                {test.delivery.filter((x) => !x.sent && x.error).map((x, i) => <div key={i} style={{ fontSize: 'var(--text-caption)', color: E.amber, marginTop: 6 }}>{x.channel}: {x.error}</div>)}
                <details style={{ marginTop: 10 }}>
                  <summary style={{ ...label, cursor: 'pointer' }}>Desk reports (what a reply of the desk code returns)</summary>
                  {test.desks.map((x) => (
                    <div key={x.desk} style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-body)' }}>{DESK_LABEL[x.desk] ?? x.desk} {!x.setUp && <Badge color={E.faint}>not set up</Badge>}</div>
                      <div style={{ fontSize: 'var(--text-caption)', color: E.muted, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{x.full}</div>
                    </div>
                  ))}
                </details>
              </>
            )}
          </div>
        )}

        {/* The standing week — what the schedule lines are built from. */}
        <Section title="Your standing week">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {DAYS.map((name, i) => <Pill key={name} active={day === i} onClick={() => setDay(i)}>{name} <span style={{ color: E.faint, fontFamily: 'var(--font-mono)' }}>{d.blocks.filter((b) => b.day_of_week === i).length}</span></Pill>)}
          </div>
          {!d.loading && d.blocks.length === 0 && <div style={{ marginBottom: 10 }}><TeachingEmpty what="No schedule blocks yet. Add your work shift, dial hour and build block for each day — the digest's first lines come from here." /></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayBlocks.map((b) => <BlockRow key={b.id} b={b} onSave={(p) => d.updateBlock(b.id, p)} onRemove={() => d.removeBlock(b.id)} />)}
          </div>
          <NewBlock day={day} onAdd={(b) => d.addBlock(b)} />
          {dayBlocks.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button style={{ ...btn('ghost'), fontSize: 12, padding: '5px 10px' }} onClick={async () => { if (await askConfirm(`Copy ${DAYS[day]} onto Mon–Fri? Their current blocks are replaced.`)) d.copyDay(day, [1, 2, 3, 4, 5].filter((x) => x !== day)); }}>Copy {DAYS[day]} to weekdays</button>
              <button style={{ ...btn('ghost'), fontSize: 12, padding: '5px 10px' }} onClick={async () => { if (await askConfirm(`Copy ${DAYS[day]} onto every other day?`)) d.copyDay(day, [0, 1, 2, 3, 4, 5, 6].filter((x) => x !== day)); }}>Copy to all days</button>
            </div>
          )}
        </Section>

        <Section title="Targets the digest measures against">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {d.targets.map((t) => <TargetField key={t.id} label={`${t.label} / ${t.period}`} value={t.target} onSave={(v) => d.saveTarget(t.id, v)} />)}
          </div>
        </Section>

        <Section title={`Today's numbers · ${localDate()}`} aside={<span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>or text "dials 30" back</span>}>
          <LogForm log={d.log} onSave={d.saveLog} />
        </Section>

        {s && (
          <Section title="Settings">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-body)', color: E.text }}><input type="checkbox" checked={s.enabled} onChange={(e) => d.saveSettings({ enabled: e.target.checked })} /> Send every morning</label>
              <div><div style={{ ...label, marginBottom: 4 }}>Send time</div><input type="time" style={{ ...field, width: 'auto' }} value={s.send_time.slice(0, 5)} onChange={(e) => e.target.value && d.saveSettings({ send_time: e.target.value })} /></div>
              <div><div style={{ ...label, marginBottom: 4 }}>Time zone</div>
                <select style={{ ...field, width: 'auto' }} value={s.timezone} onChange={(e) => d.saveSettings({ timezone: e.target.value })}>
                  {['America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Chicago', 'America/New_York'].map((z) => <option key={z} value={z}>{z}</option>)}
                </select></div>
              <div><div style={{ ...label, marginBottom: 4 }}>Channel</div>
                <select style={{ ...field, width: 'auto' }} value={s.channel} onChange={(e) => d.saveSettings({ channel: e.target.value as 'sms' | 'push' | 'both' })}>
                  <option value="both">Text + push</option><option value="sms">Text (push if it fails)</option><option value="push">Push only</option>
                </select></div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {Object.keys(DESK_LABEL).map((k) => {
                const on = s.desks?.[k] !== false;
                return <Pill key={k} active={on} onClick={() => d.saveSettings({ desks: { ...s.desks, [k]: !on } })}>{on ? '✓' : '○'} {DESK_LABEL[k]}</Pill>;
              })}
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-body)', color: E.muted, marginTop: 10 }}><input type="checkbox" checked={s.separate_texts} onChange={(e) => d.saveSettings({ separate_texts: e.target.checked })} /> Also send each desk's full report as its own text</label>
            <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6 }}>Last sent: {s.last_sent_date ?? 'never'} · Daylight saving is handled automatically.</div>
          </Section>
        )}

        {d.sends.length > 0 && (
          <Section title="Recent sends">
            {d.sends.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-caption)', color: E.muted, padding: '4px 0', borderTop: `1px solid ${E.border}`, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>{new Date(r.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                <Badge color={r.status === 'sent' ? E.green : r.status === 'preview' ? E.faint : E.red}>{r.kind} · {r.status}</Badge>
                {r.channel && <span>{r.channel}</span>}
                {r.error && <span style={{ color: E.amber }}>{r.error}</span>}
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function BlockRow({ b, onSave, onRemove }: { b: ScheduleBlock; onSave: (p: Partial<ScheduleBlock>) => void; onRemove: () => void }) {
  const [labelText, setLabelText] = useState(b.label);
  return (
    <div style={{ ...E.card, padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderLeft: `3px solid ${KIND_COLOR[b.kind]}` }}>
      <input type="time" style={{ ...field, width: 'auto' }} value={b.start_time.slice(0, 5)} onChange={(e) => e.target.value && onSave({ start_time: e.target.value })} />
      <span style={{ color: E.faint }}>–</span>
      <input type="time" style={{ ...field, width: 'auto' }} value={b.end_time.slice(0, 5)} onChange={(e) => e.target.value && onSave({ end_time: e.target.value })} />
      <input style={{ ...field, flex: '1 1 140px', width: 'auto' }} value={labelText} onChange={(e) => setLabelText(e.target.value)} onBlur={() => labelText.trim() && labelText !== b.label && onSave({ label: labelText.trim() })} />
      <select style={{ ...field, width: 'auto' }} value={b.kind} onChange={(e) => onSave({ kind: e.target.value as BlockKind })}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
      <button style={{ ...btn('ghost'), padding: '6px 10px' }} aria-label="Remove block" onClick={onRemove}>✕</button>
    </div>
  );
}

function NewBlock({ day, onAdd }: { day: number; onAdd: (b: Omit<ScheduleBlock, 'id' | 'active'>) => void }) {
  const [start, setStart] = useState('16:00');
  const [end, setEnd] = useState('17:00');
  const [labelText, setLabelText] = useState('');
  const [kind, setKind] = useState<BlockKind>('dials');
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, padding: 10, border: `1px dashed ${E.border}`, borderRadius: 'var(--radius-md)', background: tint(E.accent, 4) }}>
      <input type="time" style={{ ...field, width: 'auto' }} value={start} onChange={(e) => setStart(e.target.value)} />
      <span style={{ color: E.faint }}>–</span>
      <input type="time" style={{ ...field, width: 'auto' }} value={end} onChange={(e) => setEnd(e.target.value)} />
      <input style={{ ...field, flex: '1 1 140px', width: 'auto' }} value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="35 dials · Mastermind: invoice page · Work" />
      <select style={{ ...field, width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value as BlockKind)}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
      <button style={btn('primary')} disabled={!labelText.trim() || !start || !end} onClick={() => { onAdd({ day_of_week: day, start_time: start, end_time: end, label: labelText.trim(), kind }); setLabelText(''); }}>＋ Add to {DAYS[day]}</button>
    </div>
  );
}

function TargetField({ label: l, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div style={{ ...E.card, padding: 10 }}>
      <div style={{ ...label, marginBottom: 4 }}>{l}</div>
      <input style={{ ...field, fontFamily: 'var(--font-mono)' }} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const nv = Number(v); if (Number.isFinite(nv) && nv !== value) onSave(nv); }} />
    </div>
  );
}

function LogForm({ log, onSave }: { log: ReturnType<typeof useDigest>['log']; onSave: (p: Record<string, number | string | null>) => void }) {
  const fields: { k: 'dials' | 'conversations' | 'meetings' | 'inbound_leads' | 'posts' | 'cash_in'; l: string }[] = [
    { k: 'dials', l: 'Dials' }, { k: 'conversations', l: 'Conversations' }, { k: 'meetings', l: 'Meetings' }, { k: 'inbound_leads', l: 'Inbound' }, { k: 'posts', l: 'Posts' }, { k: 'cash_in', l: 'Cash in $' },
  ];
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { setVals(Object.fromEntries(fields.map((f) => [f.k, log?.[f.k] != null ? String(log[f.k]) : '']))); }, [log]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
        {fields.map((f) => (
          <div key={f.k}><div style={{ ...label, marginBottom: 4 }}>{f.l}</div><input style={{ ...field, fontFamily: 'var(--font-mono)' }} inputMode="decimal" value={vals[f.k] ?? ''} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} /></div>
        ))}
      </div>
      <button style={{ ...btn('primary'), marginTop: 10 }} onClick={() => onSave(Object.fromEntries(fields.map((f) => [f.k, vals[f.k]?.trim() ? Number(vals[f.k]) : null])))}>Save today</button>
      {log?.top_done && <Badge color={E.green}>#1 done today</Badge>}
    </div>
  );
}
