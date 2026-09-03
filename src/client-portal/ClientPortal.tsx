import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientPortalData } from '../data/useClientPortalData';
import type { AssignedModule, TicketWithOptions } from '../data/useClientPortalData';
import type { ClientDeliverable, ClientInvoice, ClientReport, ClientTicketKind, DeliverableKind } from '../data/types';
import { DELIVERABLE_KINDS, TICKET_KINDS } from '../data/types';
import InvoiceDocument, { money } from '../components/InvoiceDocument';
import ProgressSpine from '../components/ProgressSpine';

interface Props {
  onSignOut?: () => void;
  /** Owner's read-only preview (Client Modules) — pins the data hook to
   *  one client and turns every write into a no-op. */
  previewClientId?: string | null;
}

type Tab = 'home' | 'guides' | 'changes' | 'requests' | 'invoices' | 'messages';

// ── Styles ─────────────────────────────────────────────────────────────
// Mobile first: one column, 16px inputs, content padded past the tab bar
// plus the safe-area inset (additive, never carved out of a fixed height).
// The shell is position:relative with an absolute tab bar so the same
// component renders correctly inside the owner's preview frame.
const TAB_BAR = 64;
const page: CSSProperties = { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' };
const scroll: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `24px 18px calc(${TAB_BAR + 28}px + env(safe-area-inset-bottom))` };
const container: CSSProperties = { maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 };
const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-label)', fontWeight: 700, color: 'var(--text)', margin: '20px 0 4px' };
const muted: CSSProperties = { fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', lineHeight: 1.55 };
const body: CSSProperties = { fontSize: 'var(--text-body)', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' };
const eyebrow: CSSProperties = { ...muted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 'var(--text-micro)', fontWeight: 700 };
const primaryBtn: CSSProperties = { padding: '12px 20px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' };
const ghostBtn: CSSProperties = { padding: '9px 15px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 };
const pill = (color: string): CSSProperties => ({ fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)', padding: '3px 9px', color, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, whiteSpace: 'nowrap' });
const disabled = (off: boolean): CSSProperties => (off ? { opacity: 0.5, pointerEvents: 'none' } : {});

function invoiceColor(status: ClientInvoice['status']): string {
  if (status === 'paid') return 'var(--success)';
  if (status === 'void') return 'var(--text-tertiary)';
  return 'var(--danger)';
}

function ticketKindFor(kind: DeliverableKind): ClientTicketKind {
  if (kind === 'website' || kind === 'brand') return 'design';
  if (kind === 'payments' || kind === 'other') return 'system';
  return 'marketing';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ ...card, ...muted, borderStyle: 'dashed' }}>{children}</div>;
}

// ── Numbers ─────────────────────────────────────────────────────────────
// Real data only: baseline is the first PUBLISHED monthly report, current
// is the latest. A metric shows only if at least one of the two has a
// value; no reports at all is an honest empty state that names what's
// needed. Nothing here is ever estimated or filled in.
const METRICS: { key: keyof ClientReport; label: string }[] = [
  { key: 'gbp_views', label: 'Google profile views' },
  { key: 'gbp_calls', label: 'Calls from Google' },
  { key: 'gbp_directions', label: 'Direction requests' },
  { key: 'reach', label: 'Reach' },
  { key: 'engagement_count', label: 'Engagements' },
  { key: 'followers_end', label: 'Followers' },
];

function Numbers({ reports }: { reports: ClientReport[] }) {
  if (reports.length === 0) {
    return (
      <Empty>
        Nothing to show yet. Your numbers appear here once the first monthly report is published — it captures your baseline (Google profile views, calls, direction requests, reach) so every later month is measured against where you started. No data source is connected yet, so nothing is being estimated.
      </Empty>
    );
  }
  const baseline = reports[0];
  const current = reports[reports.length - 1];
  const rows = METRICS
    .map((m) => ({ ...m, b: baseline[m.key] as number | null, c: current[m.key] as number | null }))
    .filter((r) => r.b !== null || r.c !== null);
  if (rows.length === 0) {
    return <Empty>Reports exist for {baseline.period_label}{reports.length > 1 ? ` through ${current.period_label}` : ''}, but no metrics were recorded in them yet.</Empty>;
  }
  const same = baseline.id === current.id;
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, ...muted, marginBottom: 10 }}>
        <span>Baseline: {baseline.period_label}</span>
        {!same && <span>Now: {current.period_label}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const delta = r.b !== null && r.c !== null && !same ? r.c - r.b : null;
          return (
            <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                {!same && <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>{r.b === null ? '—' : r.b.toLocaleString()}</span>}
                <span style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, color: 'var(--text)' }}>{r.c === null ? '—' : r.c.toLocaleString()}</span>
                {delta !== null && delta !== 0 && (
                  <span style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, color: delta > 0 ? 'var(--success)' : 'var(--danger)' }}>{delta > 0 ? '▲' : '▼'}{Math.abs(delta).toLocaleString()}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {current.roi_snapshot && <div style={{ ...body, marginTop: 14, fontSize: 'var(--text-body-sm)' }}>{current.roi_snapshot}</div>}
    </div>
  );
}

// ── Guides ─────────────────────────────────────────────────────────────
function GuideDetail({ item, readOnly, onBack, onToggleDone }: { item: AssignedModule; readOnly: boolean; onBack: () => void; onToggleDone: (done: boolean) => void }) {
  const m = item.module;
  const done = !!item.completed_at;
  return (
    <div style={container}>
      <span style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={onBack}>← All guides</span>
      <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, marginTop: 6 }}>{m.title}</div>
      <div style={card}>
        <div style={eyebrow}>What it is</div>
        <div style={{ ...body, marginTop: 4 }}>{m.what_it_is}</div>
        <div style={{ ...eyebrow, marginTop: 14 }}>Why it matters</div>
        <div style={{ ...body, marginTop: 4 }}>{m.why_it_matters}</div>
      </div>
      {m.video_url && (
        <a href={m.video_url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, alignSelf: 'flex-start' }}>▶ Watch the 90-second walkthrough</a>
      )}
      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 8 }}>Steps</div>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {m.steps.map((s, i) => <li key={i} style={{ ...body, fontSize: 'var(--text-body)' }}>{s}</li>)}
        </ol>
      </div>
      <div style={{ ...card, borderColor: done ? 'color-mix(in srgb, var(--success) 45%, transparent)' : 'var(--border)' }}>
        <div style={eyebrow}>You're done when</div>
        <div style={{ ...body, marginTop: 4 }}>{m.done_when}</div>
        <div style={{ ...(done ? ghostBtn : primaryBtn), marginTop: 14, ...disabled(readOnly) }} onClick={() => onToggleDone(!done)}>{done ? 'Done ✓ — tap to undo' : 'Mark done'}</div>
      </div>
    </div>
  );
}

// ── Requests (tickets) ──────────────────────────────────────────────────
function TicketForm({ deliverables, presetDeliverable, readOnly, onSubmit, onCancel }: {
  deliverables: ClientDeliverable[];
  presetDeliverable: ClientDeliverable | null;
  readOnly: boolean;
  onSubmit: (input: { kind: ClientTicketKind; title: string; avoid: string; prefer: string; deliverable_id: string | null }) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ClientTicketKind>(presetDeliverable ? ticketKindFor(presetDeliverable.kind) : 'design');
  const [deliverableId, setDeliverableId] = useState<string>(presetDeliverable?.id ?? '');
  const [title, setTitle] = useState(presetDeliverable ? `Changes to ${presetDeliverable.title}` : '');
  const [avoid, setAvoid] = useState('');
  const [prefer, setPrefer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = title.trim().length > 0 && avoid.trim().length > 0 && prefer.trim().length > 0;

  const submit = async () => {
    setBusy(true);
    const err = await onSubmit({ kind, title, avoid, prefer, deliverable_id: deliverableId || null });
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div style={container}>
      <span style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={onCancel}>← Back</span>
      <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, marginTop: 6 }}>Ask for a change</div>
      <div style={muted}>Two things are required: what to avoid, and what you'd prefer instead. That's what lets Marq come back with real options instead of a guess. "I don't like it" on its own can't be sent.</div>
      <div style={card}>
        <div style={eyebrow}>What kind of change</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {TICKET_KINDS.map((k) => (
            <span key={k.key} onClick={() => setKind(k.key)} style={{ ...ghostBtn, borderColor: kind === k.key ? 'var(--text)' : 'var(--border-2)', color: kind === k.key ? 'var(--text)' : 'var(--text-secondary)' }}>{k.label}</span>
          ))}
        </div>
        {deliverables.length > 0 && (
          <>
            <div style={{ ...eyebrow, marginTop: 14 }}>About (optional)</div>
            <select style={{ ...input, marginTop: 6 }} value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)}>
              <option value="">— nothing specific —</option>
              {deliverables.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </>
        )}
        <div style={{ ...eyebrow, marginTop: 14 }}>Short title</div>
        <input style={{ ...input, marginTop: 6 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The homepage headline" />
        <div style={{ ...eyebrow, marginTop: 14 }}>What to avoid <span style={{ color: 'var(--danger)' }}>· required</span></div>
        <textarea style={{ ...input, marginTop: 6, minHeight: 84, resize: 'vertical' }} value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="What specifically isn't working — the thing to steer away from" />
        <div style={{ ...eyebrow, marginTop: 14 }}>What you'd prefer <span style={{ color: 'var(--danger)' }}>· required</span></div>
        <textarea style={{ ...input, marginTop: 6, minHeight: 84, resize: 'vertical' }} value={prefer} onChange={(e) => setPrefer(e.target.value)} placeholder="What you'd rather see — a direction, an example, a feeling" />
        {error && <div style={{ ...muted, color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...primaryBtn, ...disabled(!ready || busy || readOnly) }} onClick={submit}>{busy ? 'Sending…' : 'Send to Marq'}</span>
          {!ready && <span style={muted}>Fill in both required fields to send.</span>}
        </div>
      </div>
    </div>
  );
}

function ticketStatus(t: TicketWithOptions): { label: string; color: string } {
  if (t.status === 'resolved') return { label: 'Resolved', color: 'var(--success)' };
  if (t.status === 'options_sent') return { label: 'Your pick', color: 'var(--warning)' };
  return { label: 'With Marq', color: 'var(--text-tertiary)' };
}

function TicketDetail({ ticket, deliverable, readOnly, onBack, onChoose }: { ticket: TicketWithOptions; deliverable: ClientDeliverable | null; readOnly: boolean; onBack: () => void; onChoose: (optionId: string) => void }) {
  const st = ticketStatus(ticket);
  const chosen = ticket.options.find((o) => o.chosen_at);
  return (
    <div style={container}>
      <span style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={onBack}>← All requests</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--text-head)', fontWeight: 700 }}>{ticket.title}</div>
        <span style={pill(st.color)}>{st.label}</span>
      </div>
      <div style={muted}>{TICKET_KINDS.find((k) => k.key === ticket.kind)?.label}{deliverable ? ` · about ${deliverable.title}` : ''} · sent {fmtDate(ticket.created_at)}</div>
      <div style={card}>
        <div style={eyebrow}>Avoid</div>
        <div style={{ ...body, marginTop: 4 }}>{ticket.avoid}</div>
        <div style={{ ...eyebrow, marginTop: 14 }}>Prefer</div>
        <div style={{ ...body, marginTop: 4 }}>{ticket.prefer}</div>
      </div>
      {ticket.status === 'open' && <Empty>Marq has this. You'll get two or three options to choose between here — not a single redo.</Empty>}
      {ticket.options.length > 0 && (
        <>
          <div style={sectionTitle}>{ticket.status === 'resolved' ? 'What you chose' : 'Pick one'}</div>
          {ticket.owner_note && <div style={{ ...card, ...body, fontSize: 'var(--text-body-sm)' }}>{ticket.owner_note}</div>}
          {ticket.options.map((o, i) => {
            const isChosen = !!o.chosen_at;
            const dim = ticket.status === 'resolved' && !isChosen;
            return (
              <div key={o.id} style={{ ...card, opacity: dim ? 0.55 : 1, borderColor: isChosen ? 'color-mix(in srgb, var(--success) 45%, transparent)' : 'var(--border)' }}>
                <div style={eyebrow}>Option {i + 1}{isChosen ? ' · chosen' : ''}</div>
                <div style={{ ...body, marginTop: 4 }}>{o.body}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  {o.link_url && <a href={o.link_url} target="_blank" rel="noreferrer" style={ghostBtn}>See it ↗</a>}
                  {ticket.status === 'options_sent' && <span style={{ ...primaryBtn, ...disabled(readOnly) }} onClick={() => onChoose(o.id)}>Go with this one</span>}
                </div>
              </div>
            );
          })}
          {ticket.status === 'resolved' && !chosen && <div style={muted}>Closed by Marq.</div>}
        </>
      )}
    </div>
  );
}

// ── Portal ─────────────────────────────────────────────────────────────
export default function ClientPortal({ onSignOut, previewClientId = null }: Props) {
  const data = useClientPortalData(previewClientId);
  const { client, settings, deliverables, modules, messages, invoices, reports, tickets, changelog, spine, readOnly } = data;
  const [tab, setTab] = useState<Tab>('home');
  const [guideId, setGuideId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState<{ open: boolean; deliverable: ClientDeliverable | null }>({ open: false, deliverable: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // The portal is its own place: /portal in the address bar, nothing of
  // the owner tool. Cosmetic — App.tsx routes on role, not path. Skipped
  // in the owner's preview, which lives inside the owner tool.
  useEffect(() => {
    if (!readOnly && window.location.pathname !== '/portal') window.history.replaceState(null, '', '/portal');
  }, [readOnly]);

  useEffect(() => {
    if (tab === 'messages') data.markOwnerMessagesRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, messages.length]);

  if (data.loading) return <div style={page} />;

  if (!client) {
    return (
      <div style={page}>
        <div style={scroll}>
          <div style={container}>
            <div style={card}>Nothing set up for this login yet — check back soon, or reach out to Marq.</div>
            {onSignOut && <span style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={onSignOut}>Sign out</span>}
          </div>
        </div>
      </div>
    );
  }

  const unreadFromOwner = messages.filter((m) => m.sender === 'owner' && !m.read_at).length;
  const awaitingPick = tickets.filter((t) => t.status === 'options_sent').length;
  const doneCount = modules.filter((m) => m.completed_at).length;
  const handoff = !!settings?.handoff_mode;
  const openGuide = modules.find((m) => m.id === guideId) ?? null;
  const openInvoice = invoices.find((i) => i.id === invoiceId) ?? null;
  const openTicket = tickets.find((t) => t.id === ticketId) ?? null;
  const toReview = deliverables.filter((d) => d.status === 'review' && !d.approved_at);

  const openGuideAt = (item: AssignedModule) => {
    setGuideId(item.id);
    data.markOpened(item.id);
  };

  const startTicket = (deliverable: ClientDeliverable | null) => {
    setTicketForm({ open: true, deliverable });
    setTicketId(null);
    setTab('requests');
  };

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    await data.sendMessage(draft);
    setDraft('');
    setSending(false);
  };

  const renderHome = () => (
    <div style={container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          {settings?.logo_url && <img src={settings.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={muted}>Welcome back</div>
            <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, marginTop: 2, overflowWrap: 'anywhere' }}>{client.business_name}</div>
          </div>
        </div>
        {onSignOut && !readOnly && <span style={{ ...muted, cursor: 'pointer', flexShrink: 0 }} onClick={onSignOut}>Sign out</span>}
      </div>

      {/* The spine first — the answer to "is anything happening" before
          they scroll or ask. */}
      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 12 }}>Where things stand</div>
        <ProgressSpine stations={spine} />
      </div>

      {toReview.length > 0 && (
        <div style={{ ...card, border: '1px solid color-mix(in srgb, var(--warning) 50%, transparent)', background: 'color-mix(in srgb, var(--warning) 7%, transparent)' }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 700 }}>{toReview.length === 1 ? 'One thing needs your OK' : `${toReview.length} things need your OK`}</div>
          <div style={{ ...muted, marginTop: 4 }}>Nothing goes live until you've seen it. Scroll to “What we built” to approve or ask for changes.</div>
        </div>
      )}

      {handoff && (
        <div style={{ ...card, border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)', background: 'color-mix(in srgb, var(--success) 8%, transparent)' }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--success)' }}>You're running this now</div>
          <div style={{ ...muted, marginTop: 4 }}>
            {modules.length === 0 ? 'Your guides are being assigned.' : `${doneCount} of ${modules.length} guides done.`}
            {settings?.handoff_checkin_on ? ` Marq checks in with you on ${settings.handoff_checkin_on}.` : ''}
          </div>
          {modules.length > 0 && <span style={{ ...primaryBtn, marginTop: 12 }} onClick={() => setTab('guides')}>Open the guides</span>}
        </div>
      )}

      {settings?.welcome_text ? (
        <div style={{ ...card, ...body }}>{settings.welcome_text}</div>
      ) : (
        <Empty>Marq hasn't written your welcome note yet.</Empty>
      )}

      {/* The teach-back frame, stated once, on day one. */}
      <div style={card}>
        <div style={eyebrow}>How this works</div>
        <div style={{ ...body, marginTop: 4, fontSize: 'var(--text-body-sm)' }}>
          Made by Marq builds the thing, then teaches you to run it. Strategy and the build stay with Marq. The day-to-day — taking payments, posting, answering reviews, reading your numbers — gets handed to you one short guide at a time, so you're never dependent on anyone for the parts you can own. That's the plan from day one, not a surprise in month three.
        </div>
      </div>

      {settings?.next_steps && (
        <div style={card}>
          <div style={eyebrow}>What happens next</div>
          <div style={{ ...body, marginTop: 4 }}>{settings.next_steps}</div>
        </div>
      )}

      <div style={sectionTitle}>What we built</div>
      {deliverables.length === 0 && <Empty>Nothing delivered yet — each piece shows up here with what it is and why it matters for {client.business_name}.</Empty>}
      {deliverables.map((d) => {
        const color = d.status === 'live' ? 'var(--success)' : d.status === 'review' ? 'var(--warning)' : 'var(--text-tertiary)';
        const needsOk = d.status === 'review' && !d.approved_at;
        return (
          <div key={d.id} style={{ ...card, borderColor: needsOk ? 'color-mix(in srgb, var(--warning) 50%, transparent)' : 'var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={eyebrow}>{DELIVERABLE_KINDS.find((k) => k.key === d.kind)?.label ?? d.kind}</div>
                <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, marginTop: 2 }}>{d.title}</div>
              </div>
              <span style={pill(color)}>{d.status === 'in_progress' ? 'in progress' : d.status === 'review' ? (d.approved_at ? 'approved' : 'your OK') : d.status}</span>
            </div>
            {d.what_it_is && <div style={{ ...body, marginTop: 10 }}>{d.what_it_is}</div>}
            {d.why_it_matters && (
              <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid var(--border-2)' }}>
                <div style={eyebrow}>Why it matters for you</div>
                <div style={{ ...body, marginTop: 2, fontSize: 'var(--text-body-sm)' }}>{d.why_it_matters}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {d.link_url && <a href={d.link_url} target="_blank" rel="noreferrer" style={ghostBtn}>Open ↗</a>}
              {needsOk && (
                <>
                  <span style={{ ...primaryBtn, ...disabled(readOnly) }} onClick={() => data.approveDeliverable(d.id)}>Looks good — approve</span>
                  <span style={{ ...ghostBtn, ...disabled(readOnly) }} onClick={() => startTicket(d)}>Ask for changes</span>
                </>
              )}
              {d.status === 'review' && d.approved_at && <span style={muted}>You approved this {fmtDate(d.approved_at)}.</span>}
            </div>
          </div>
        );
      })}

      <div style={sectionTitle}>Your numbers</div>
      <Numbers reports={reports} />
    </div>
  );

  const renderGuides = () => {
    if (openGuide) return <GuideDetail item={openGuide} readOnly={readOnly} onBack={() => setGuideId(null)} onToggleDone={(done) => data.setCompleted(openGuide.id, done)} />;
    return (
      <div style={container}>
        <div style={{ fontSize: 'var(--text-head)', fontWeight: 700 }}>How to run it</div>
        <div style={muted}>Short guides for the parts you run yourself. Each one ends with how you know you're done.</div>
        {modules.length > 0 && (
          <div style={{ ...muted, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface-4)', overflow: 'hidden' }}>
              <div style={{ width: `${modules.length ? (doneCount / modules.length) * 100 : 0}%`, height: '100%', background: 'var(--success)' }} />
            </div>
            <span>{doneCount}/{modules.length} done</span>
          </div>
        )}
        {modules.length === 0 && <Empty>No guides assigned yet. They're matched to what was actually built for you, so they show up as each piece goes live.</Empty>}
        {modules.map((m) => (
          <div key={m.id} style={{ ...card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderColor: m.completed_at ? 'color-mix(in srgb, var(--success) 45%, transparent)' : 'var(--border)' }} onClick={() => openGuideAt(m)}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{m.module.title}</div>
              <div style={{ ...muted, marginTop: 2 }}>{m.completed_at ? 'Done' : m.opened_at ? 'Started' : 'New'}{m.module.video_url ? ' · video' : ''} · {m.module.steps.length} steps</div>
            </div>
            <span style={{ color: m.completed_at ? 'var(--success)' : 'var(--text-tertiary)', fontWeight: 700 }}>{m.completed_at ? '✓' : '›'}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderChanges = () => (
    <div style={container}>
      <div style={{ fontSize: 'var(--text-head)', fontWeight: 700 }}>What's changed</div>
      <div style={muted}>Everything that's shipped for {client.business_name}, newest first — what changed, when, and why.</div>
      {changelog.length === 0 && <Empty>Nothing logged yet. The first line lands here the moment something ships.</Empty>}
      {changelog.map((e) => (
        <div key={e.id} style={{ display: 'flex', gap: 14 }}>
          <div style={{ ...muted, width: 52, flexShrink: 0, paddingTop: 2 }}>{fmtDate(e.happened_on)}</div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, overflowWrap: 'anywhere' }}>{e.what}</div>
            {e.why && <div style={{ ...muted, marginTop: 3, overflowWrap: 'anywhere' }}>{e.why}</div>}
          </div>
        </div>
      ))}
    </div>
  );

  const renderRequests = () => {
    if (ticketForm.open) {
      return (
        <TicketForm
          deliverables={deliverables}
          presetDeliverable={ticketForm.deliverable}
          readOnly={readOnly}
          onCancel={() => setTicketForm({ open: false, deliverable: null })}
          onSubmit={async (input) => {
            const err = await data.fileTicket(input);
            if (!err) setTicketForm({ open: false, deliverable: null });
            return err;
          }}
        />
      );
    }
    if (openTicket) {
      return <TicketDetail ticket={openTicket} deliverable={deliverables.find((d) => d.id === openTicket.deliverable_id) ?? null} readOnly={readOnly} onBack={() => setTicketId(null)} onChoose={(optionId) => data.chooseOption(openTicket.id, optionId)} />;
    }
    return (
      <div style={container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 'var(--text-head)', fontWeight: 700 }}>Requests</div>
          <span style={{ ...primaryBtn, padding: '9px 16px', fontSize: 'var(--text-body-sm)' }} onClick={() => startTicket(null)}>+ Ask for a change</span>
        </div>
        <div style={muted}>Design, marketing, or system changes. You say what to avoid and what you'd prefer; Marq comes back with two or three options and you pick. Quick questions go in Messages instead.</div>
        {tickets.length === 0 && <Empty>No requests yet.</Empty>}
        {tickets.map((t) => {
          const st = ticketStatus(t);
          return (
            <div key={t.id} style={{ ...card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }} onClick={() => setTicketId(t.id)}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, overflowWrap: 'anywhere' }}>{t.title}</div>
                <div style={{ ...muted, marginTop: 2 }}>{TICKET_KINDS.find((k) => k.key === t.kind)?.label} · {fmtDate(t.created_at)}{t.status === 'options_sent' ? ` · ${t.options.length} options waiting` : ''}</div>
              </div>
              <span style={pill(st.color)}>{st.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderInvoices = () => {
    if (openInvoice) {
      return (
        <div style={container}>
          <span style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={() => setInvoiceId(null)}>← All invoices</span>
          <InvoiceDocument billTo={client.business_name} description={openInvoice.description} amount={openInvoice.amount} dueDate={openInvoice.due_date} invoiceNumber={openInvoice.invoice_number} status={openInvoice.status} paidAt={openInvoice.paid_at} />
          {openInvoice.status !== 'paid' && openInvoice.status !== 'void' && openInvoice.stripe_invoice_url && (
            <a href={openInvoice.stripe_invoice_url} target="_blank" rel="noreferrer" style={{ ...primaryBtn, alignSelf: 'flex-start' }}>Pay now</a>
          )}
        </div>
      );
    }
    return (
      <div style={container}>
        <div style={{ fontSize: 'var(--text-head)', fontWeight: 700 }}>Invoices</div>
        {invoices.length === 0 && <Empty>Nothing sent yet.</Empty>}
        {invoices.map((inv) => (
          <div key={inv.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setInvoiceId(inv.id)}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{inv.description}</div>
              <div style={{ ...muted, marginTop: 3 }}>{money(inv.amount)}{inv.due_date ? ` · due ${inv.due_date}` : ''} · #{inv.invoice_number}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={pill(invoiceColor(inv.status))}>{inv.status}</span>
              {inv.status !== 'paid' && inv.status !== 'void' && inv.stripe_invoice_url && (
                <a href={inv.stripe_invoice_url} target="_blank" rel="noreferrer" style={{ ...primaryBtn, padding: '9px 16px', fontSize: 'var(--text-body-sm)' }} onClick={(e) => e.stopPropagation()}>Pay</a>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMessages = () => (
    <div style={container}>
      <div style={{ fontSize: 'var(--text-head)', fontWeight: 700 }}>Messages</div>
      <div style={muted}>Quick questions, anything small. Marq sees these right away. Want something changed? Use Requests — it gets you options, faster.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <Empty>No messages yet. Ask anything — a question, a problem, a photo you want on the site.</Empty>}
        {messages.map((m) => {
          const mine = m.sender === 'client';
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: 16, background: mine ? 'var(--text)' : 'var(--surface-2)', color: mine ? 'var(--bg)' : 'var(--text)', border: mine ? 'none' : '1px solid var(--border)' }}>
              <div style={{ fontSize: 'var(--text-body)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
              <div style={{ fontSize: 'var(--text-tiny)', opacity: 0.6, marginTop: 4 }}>{mine ? 'You' : 'Marq'} · {new Date(m.created_at).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea style={{ ...input, minHeight: 48, maxHeight: 160, resize: 'vertical', flex: 1 }} placeholder="Write a message…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <span style={{ ...primaryBtn, ...disabled(sending || !draft.trim() || readOnly) }} onClick={send}>Send</span>
      </div>
    </div>
  );

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'home', label: 'Home', badge: toReview.length },
    { key: 'guides', label: 'Guides', badge: handoff && modules.length ? modules.length - doneCount : 0 },
    { key: 'changes', label: 'Changes' },
    { key: 'requests', label: 'Requests', badge: awaitingPick },
    { key: 'invoices', label: 'Invoices', badge: invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length },
    { key: 'messages', label: 'Messages', badge: unreadFromOwner },
  ];

  return (
    <div style={page}>
      {readOnly && (
        <div style={{ flexShrink: 0, padding: '8px 14px', fontSize: 'var(--text-caption)', color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)' }}>
          Preview — exactly what {client.business_name} sees. Actions are disabled here.
        </div>
      )}
      <div style={scroll}>
        {tab === 'home' && renderHome()}
        {tab === 'guides' && renderGuides()}
        {tab === 'changes' && renderChanges()}
        {tab === 'requests' && renderRequests()}
        {tab === 'invoices' && renderInvoices()}
        {tab === 'messages' && renderMessages()}
      </div>
      <nav style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface-2)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', zIndex: 10 }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <div key={t.key} onClick={() => { setTab(t.key); setGuideId(null); setInvoiceId(null); setTicketId(null); setTicketForm({ open: false, deliverable: null }); }} style={{ flex: 1, height: TAB_BAR, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: active ? 'var(--text)' : 'var(--text-tertiary)', position: 'relative', minWidth: 0 }}>
              <div style={{ width: 22, height: 3, borderRadius: 2, background: active ? 'var(--text)' : 'transparent' }} />
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{t.label}</span>
              {!!t.badge && (
                <span style={{ position: 'absolute', top: 10, right: 'calc(50% - 26px)', minWidth: 16, height: 16, borderRadius: 8, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{t.badge}</span>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
