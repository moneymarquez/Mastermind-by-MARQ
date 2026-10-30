import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { api } from '../../../lib/api';
import { recordLeadTouch } from '../../../data/useMktEngine';
import { ensureCrmClientForLead } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import type { CallKit } from '../../../data/callKit';

interface Snapshot { date: string; generated_at: string; test_mode: boolean; source: 'snapshot' | 'live'; items: CallKit[] }

/** One tap per outcome, the same statuses the Pool and Dialing log. */
const OUTCOMES: { value: string; label: string; primary?: boolean }[] = [
  { value: 'no_answer', label: 'No answer' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
  { value: 'callback', label: 'Callback' },
  { value: 'interested', label: 'Interested', primary: true },
  { value: 'not_interested', label: 'Not interested' },
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label]));
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

/** LeadFlow → Call list: the cold-call kit (Growth Blueprint phase 1). Every
 *  callable lead ranked by fit × estimated monthly leak, each with a one-line
 *  opener, who to ask for and the inputs behind the estimate. Ready by 8 AM
 *  Denver (the Worker's morning snapshot); logging an outcome only updates
 *  the lead. Nothing here sends a text, an email or places a call: Call
 *  opens the phone's own dialer. `children` is the email follow-up list. */
export default function LeadFlowCallList({ phone, children }: { phone: boolean; children?: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(true);
  const [note, setNote] = useState('');
  const load = useCallback(async (fresh = false) => {
    setBusy(true);
    const r = await api<Snapshot>(`/api/leadflow/call-kit${fresh ? '?fresh=1' : ''}`);
    if (r.error) setErr(r.error); else { setErr(''); setSnap(r); }
    setBusy(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const log = async (k: CallKit, status: string) => {
    const now = new Date().toISOString();
    const r = await api(`/api/leadflow/leads/${k.leadId}`, { method: 'PATCH', body: { status, call_count: k.callCount + 1, last_called_at: now } });
    if (r.error) { setErr(r.error); return; }
    setSnap((s) => (s ? { ...s, items: s.items.map((x) => (x.leadId === k.leadId ? { ...x, status, lastCalledAt: now, callCount: x.callCount + 1 } : x)) } : s));
    const lead = { id: k.leadId, business_name: k.business, phone: k.phone, owner_name: k.person?.role === 'owner' ? k.person.name : null, fizzle_score: k.fizzle, tier: k.tier } as unknown as LeadflowLead;
    void recordLeadTouch(lead, status);
    // Interested → a Client CRM record on step 2 Win, same as the Pool.
    if (status === 'interested') void ensureCrmClientForLead(lead).then((id) => setNote(id ? `${k.business} is in Client CRM now (step 2 · Win): book the discovery call.` : `Logged Interested, but the Client CRM record didn't save. Add ${k.business} in Client CRM.`)).catch(() => setNote(`Logged Interested, but the Client CRM record didn't save. Add ${k.business} in Client CRM.`));
    else setNote('');
  };

  const items = useMemo(() => snap?.items ?? [], [snap]);
  const done = items.filter((k) => isToday(k.lastCalledAt));
  const shown = hideDone ? items.filter((k) => !isToday(k.lastCalledAt)) : items;
  const total = items.reduce((s, k) => s + (k.leak?.monthly ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontSize: 15, color: 'var(--text)' }}>{snap ? `${shown.length} to call${done.length ? ` · ${done.length} done today` : ''}` : 'Call list'}</strong>
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            {snap ? `${snap.source === 'snapshot' ? `Built ${time(snap.generated_at)}` : 'Built just now'} · ranked by fit × estimated leak${total ? ` · ${usd(total)}/mo est. across the list` : ''}` : busy ? 'Loading…' : ''}
          </span>
        </div>
        {snap?.test_mode && <Chip k="warn" title="DRY_RUN is on. The call list never sends anything either way.">Test mode</Chip>}
        <button className="mm-btn" style={{ height: 34 }} onClick={() => setHideDone((v) => !v)}>{hideDone ? 'Show called' : 'Hide called'}</button>
        <button className="mm-btn" style={{ height: 34 }} disabled={busy} onClick={() => void load(true)}>{busy ? 'Ranking…' : 'Re-rank'}</button>
      </div>
      {err && <Empty text={err} />}
      {note && <span role="status" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{note}</span>}
      {snap && !items.length && <Empty text="No callable leads yet. Leads need a phone number and can't be done, dead or do-not-contact. Find more in Pool or Finder." />}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10, alignItems: 'start' }}>
        {shown.map((k) => {
          const rank = items.indexOf(k) + 1;
          const called = isToday(k.lastCalledAt);
          const why = open === k.leadId;
          return (
            <article key={k.leadId} aria-label={`${rank}. ${k.business}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', opacity: called ? 0.7 : 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 'var(--g-r-sm)', background: 'var(--surface-3)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rank}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <strong style={{ fontSize: 15, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.business}</strong>
                  <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[k.city, k.phone].filter(Boolean).join(' · ')}</span>
                </div>
                {k.leak && (
                  <button onClick={() => setOpen(why ? null : k.leadId)} aria-expanded={why} title="How this estimate was worked out" style={{ all: 'unset', cursor: 'pointer', flex: 'none', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <strong style={{ fontSize: 15, color: 'var(--text)' }}>~{usd(k.leak.monthly)}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>/mo</span></strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textDecoration: 'underline dotted' }}>estimated leak</span>
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip k={k.person ? 'accent' : 'neutral'} title={k.person?.why}>{k.person ? `Ask for ${k.person.name}${k.person.role === 'owner' ? ' (owner)' : ''}` : 'Ask for the owner or manager'}</Chip>
                <Chip k="neutral">Best: {k.bestTime}</Chip>
                {k.status && OUTCOME_LABEL[k.status] && <Chip k={called ? 'good' : 'warn'}>{called ? 'Today' : 'Last'}: {OUTCOME_LABEL[k.status]}</Chip>}
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text)', background: 'var(--surface-2)', borderRadius: 'var(--g-r-md)', padding: '10px 12px' }}>{k.opener}</p>
              {k.backup && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Backup: {k.backup}</span>}
              {why && k.leak && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>Estimate: {usd(k.leak.low)}–{usd(k.leak.high)} a month, from public data and assumptions, not their books.</span>
                  {k.leak.inputs.map((i) => <span key={i.label}><span style={{ color: 'var(--text-tertiary)' }}>{i.label}:</span> {i.value}</span>)}
                  <span style={{ color: 'var(--text-tertiary)' }}>Ranked {k.score}/100: {k.why.join(', ')}.</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {k.phone && <a className="mm-btn mm-btn--primary" style={{ ...btn, height: 40, padding: '0 18px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`tel:${(k.person?.direct ?? k.phone).replace(/[^\d+]/g, '')}`}>Call{k.person?.direct ? ' direct' : ''}</a>}
                {OUTCOMES.map((o) => (
                  <button key={o.value} className={`mm-btn${o.primary ? ' mm-btn--primary' : ''}`} style={btn} aria-pressed={k.status === o.value && called} onClick={() => void log(k, o.value)}>{o.label}</button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {!busy && !snap && !err && <Empty text="Loading…" />}
      {children && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <strong style={{ fontSize: 15, color: 'var(--text)' }}>Email follow-ups to call</strong>
          {children}
        </section>
      )}
    </div>
  );
}

const btn: CSSProperties = { height: 34, padding: '0 11px', fontSize: 13 };
