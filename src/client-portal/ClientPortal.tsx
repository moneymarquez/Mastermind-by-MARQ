import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useClientPortalData } from '../data/useClientPortalData';
import type { AssignedModule, TicketWithOptions } from '../data/useClientPortalData';
import type { ClientDeliverable, ClientInvoice, ClientReport, ClientTicketKind, DeliverableKind } from '../data/types';
import { DELIVERABLE_KINDS, TICKET_KINDS } from '../data/types';
import InvoiceDocument, { money } from '../components/InvoiceDocument';
import ProgressSpine from '../components/ProgressSpine';
import Chip from '../components/mm/Chip';
import type { ChipKind } from '../components/mm/Chip';
import Row from '../components/mm/Row';
import { Line } from '../components/mm/charts';

interface Props {
  onSignOut?: () => void;
  /** Owner's read-only preview (Client Modules): pins the data hook to
   *  one client and turns every write into a no-op. */
  previewClientId?: string | null;
}

type Tab = 'home' | 'progress' | 'numbers' | 'help';

// ── Styles (design handoff: MM 4 Clients, teal = --client-accent) ──────
// Mobile first, one column, 16px inputs. The shell is position:relative
// with an absolute tab bar so it also renders inside the owner's preview.
const TAB_BAR = 64;
const page: CSSProperties = { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' };
const scroll: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `16px 16px calc(${TAB_BAR + 28}px + env(safe-area-inset-bottom))` };
const container: CSSProperties = { maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 };
const cardS: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 };
const muted: CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 };
const body: CSSProperties = { fontSize: 15, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: 0 };
const small: CSSProperties = { fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)' };
const label: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' };
const teal: CSSProperties = { height: 46, padding: '0 18px', borderRadius: 8, border: 0, background: 'var(--client-accent)', color: 'var(--bg)', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' };
const ghost: CSSProperties = { height: 46, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'inherit', lineHeight: 1.45 };
const off = (o: boolean): CSSProperties => (o ? { opacity: 0.5, pointerEvents: 'none' } : {});

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
const invoiceChip = (s: ClientInvoice['status']): { l: string; k: ChipKind } =>
  s === 'paid' ? { l: 'Paid', k: 'good' } : s === 'void' ? { l: 'Void', k: 'neutral' } : s === 'overdue' ? { l: 'Overdue', k: 'bad' } : s === 'sent' ? { l: 'Due', k: 'warn' } : { l: s, k: 'neutral' };
const deliverableChip = (d: ClientDeliverable): { l: string; k: ChipKind } =>
  d.status === 'live' ? { l: 'Live', k: 'good' } : d.status === 'review' ? (d.approved_at ? { l: 'Approved', k: 'good' } : { l: 'In review', k: 'client' }) : { l: 'In progress', k: 'neutral' };
function ticketStatus(t: TicketWithOptions): { l: string; k: ChipKind } {
  if (t.status === 'resolved') return { l: 'Resolved', k: 'good' };
  if (t.status === 'options_sent') return { l: 'Your pick', k: 'client' };
  return { l: 'With Marq', k: 'neutral' };
}

function Card({ title, meta, flush, accent, children }: { title?: ReactNode; meta?: ReactNode; flush?: boolean; accent?: boolean; children: ReactNode }) {
  return (
    <section style={{ ...cardS, ...(flush ? { padding: '18px 18px 4px', gap: 4 } : {}), ...(accent ? { borderColor: 'color-mix(in srgb, var(--client-accent) 40%, var(--border))' } : {}) }}>
      {(title || meta) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</span>
        {meta && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{meta}</span>}
      </div>}
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: ReactNode }) => <div style={{ ...cardS, ...muted, borderStyle: 'dashed', background: 'transparent' }}>{children}</div>;
const Back = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button onClick={onClick} style={{ alignSelf: 'flex-start', height: 36, marginLeft: -4, padding: 0, border: 0, background: 'transparent', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>‹ {children}</button>
);
const H1 = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{children}</h1>
    {sub && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{sub}</p>}
  </div>
);

// ── Numbers ─────────────────────────────────────────────────────────────
// Real data only: published monthly reports, oldest first. The lead metric
// is the first one with a value; the sentence under it compares with the
// month before, and nothing is estimated or filled in.
const METRICS: { key: keyof ClientReport; label: string }[] = [
  { key: 'gbp_calls', label: 'Calls from Google' },
  { key: 'gbp_views', label: 'Google profile views' },
  { key: 'gbp_directions', label: 'Direction requests' },
  { key: 'reach', label: 'Reach' },
  { key: 'engagement_count', label: 'Engagements' },
  { key: 'followers_end', label: 'Followers' },
];
const val = (r: ClientReport | undefined, k: keyof ClientReport) => (r ? (r[k] as number | null) : null);

function Numbers({ reports }: { reports: ClientReport[] }) {
  if (reports.length === 0) {
    return <Empty>Nothing to show yet. Your numbers appear here once the first monthly report is published. It records where you started (Google profile views, calls, direction requests, reach), so every later month is measured against it.</Empty>;
  }
  const cur = reports[reports.length - 1], prev = reports.length > 1 ? reports[reports.length - 2] : undefined, first = reports[0];
  const present = METRICS.filter((m) => reports.some((r) => val(r, m.key) !== null));
  if (!present.length) return <Empty>Reports exist for {first.period_label}{reports.length > 1 ? ` through ${cur.period_label}` : ''}, but no numbers were recorded in them yet.</Empty>;
  const lead = present.find((m) => val(cur, m.key) !== null) ?? present[0];
  const lc = val(cur, lead.key), lp = val(prev, lead.key);
  const series = reports.map((r) => val(r, lead.key)).filter((v): v is number => v !== null);
  const sentence = lc === null ? `Not recorded for ${cur.period_label}.`
    : lp === null ? (prev ? `${prev.period_label} wasn't recorded, so there's nothing to compare yet.` : `This is your starting point. Next month is measured against it.`)
    : lc === lp ? `The same as ${prev!.period_label}.`
    : `That's ${Math.abs(lc - lp).toLocaleString()} ${lc > lp ? 'more' : 'fewer'} than ${prev!.period_label}.`;
  const rest = present.filter((m) => m.key !== lead.key);
  return (
    <>
      <section style={{ ...cardS, padding: 20, gap: 14 }}>
        <span style={label}>{lead.label}</span>
        <span style={{ color: 'var(--text)', fontSize: 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{lc === null ? '—' : lc.toLocaleString()}</span>
        <p style={{ ...body, textWrap: 'pretty' } as CSSProperties}>{sentence}{cur.roi_snapshot ? ` ${cur.roi_snapshot}` : ''}</p>
        {series.length >= 2 && <Line vals={series} labels={[first.period_label, cur.period_label]} color="client" h={120} />}
      </section>
      {rest.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {rest.map((m) => {
            const c = val(cur, m.key), p = val(prev, m.key), d = c !== null && p !== null ? c - p : null;
            return (
              <div key={m.key} style={{ ...cardS, padding: 14, gap: 6 }}>
                <span style={label}>{m.label}</span>
                <span style={{ color: 'var(--text)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{c === null ? '—' : c.toLocaleString()}</span>
                {d !== null && d !== 0 && <span style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: d > 0 ? 'var(--success)' : 'var(--danger)', background: `color-mix(in srgb, ${d > 0 ? 'var(--success)' : 'var(--danger)'} 14%, transparent)` }}>{d > 0 ? '↑' : '↓'} {Math.abs(d).toLocaleString()}</span>}
              </div>
            );
          })}
        </div>
      )}
      {cur.upcoming_plan && <Card title="What's next" meta={cur.period_label}><p style={body}>{cur.upcoming_plan}</p></Card>}
    </>
  );
}

// ── Guides ─────────────────────────────────────────────────────────────
function GuideDetail({ item, readOnly, onBack, onToggleDone }: { item: AssignedModule; readOnly: boolean; onBack: () => void; onToggleDone: (done: boolean) => void }) {
  const m = item.module;
  const done = !!item.completed_at;
  return (
    <div style={container}>
      <Back onClick={onBack}>Progress</Back>
      <H1>{m.title}</H1>
      <Card title="What it is"><p style={body}>{m.what_it_is}</p><span style={label}>Why it matters</span><p style={body}>{m.why_it_matters}</p></Card>
      {m.video_url && <a href={m.video_url} target="_blank" rel="noreferrer" style={{ ...ghost, alignSelf: 'flex-start' }}>Watch the 90-second walkthrough</a>}
      <Card title="Steps" meta={`${m.steps.length}`}>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>{m.steps.map((s, i) => <li key={i} style={body}>{s}</li>)}</ol>
      </Card>
      <Card title="You're done when" accent={done}>
        <p style={body}>{m.done_when}</p>
        <button style={{ ...(done ? ghost : teal), ...off(readOnly) }} onClick={() => onToggleDone(!done)}>{done ? 'Done ✓ · tap to undo' : 'Mark done'}</button>
      </Card>
    </div>
  );
}

// ── Tickets ─────────────────────────────────────────────────────────────
function TicketForm({ deliverables, presetDeliverable, readOnly, onSubmit, onCancel }: {
  deliverables: ClientDeliverable[]; presetDeliverable: ClientDeliverable | null; readOnly: boolean;
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
  const submit = async () => { setBusy(true); const err = await onSubmit({ kind, title, avoid, prefer, deliverable_id: deliverableId || null }); setBusy(false); if (err) setError(err); };
  const req = <span style={{ color: 'var(--danger)' }}>Required</span>;
  const fieldBox = (l: ReactNode, el: ReactNode, hint?: string) => <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>{l}</span>{el}{hint && <span style={small}>{hint}</span>}</div>;
  return (
    <div style={container}>
      <Back onClick={onCancel}>Help</Back>
      <H1 sub="We'll reply here and by email">New ticket</H1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TICKET_KINDS.map((k) => <button key={k.key} onClick={() => setKind(k.key)} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${kind === k.key ? 'var(--client-accent)' : 'var(--border)'}`, background: kind === k.key ? 'color-mix(in srgb, var(--client-accent) 14%, var(--surface))' : 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{k.label}</button>)}
      </div>
      {deliverables.length > 0 && fieldBox('About (optional)', <select style={input} value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)}><option value="">Nothing specific</option>{deliverables.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>)}
      {fieldBox("What's going on?", <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Book now button doesn't show on my phone" />)}
      {fieldBox(<>What should we avoid? {req}</>, <textarea style={{ ...input, minHeight: 84, resize: 'vertical' }} value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="Don't change the colors or move the phone number" />)}
      {fieldBox(<>What would you prefer? {req}</>, <textarea style={{ ...input, minHeight: 84, resize: 'vertical', ...(avoid.trim() && !prefer.trim() ? { border: '1.5px solid var(--client-accent)' } : {}) }} value={prefer} onChange={(e) => setPrefer(e.target.value)} placeholder="For example: the same button as desktop, pinned to the bottom" />, 'This helps us get it right the first time.')}
      {error && <span style={{ fontSize: 14, color: 'var(--danger)' }}>{error}</span>}
      <button style={{ ...(ready ? teal : { ...teal, background: 'var(--surface-3)', color: 'var(--text-tertiary)' }), height: 52, fontSize: 16, ...off(!ready || busy || readOnly) }} onClick={submit}>{busy ? 'Sending…' : 'Send ticket'}</button>
    </div>
  );
}

function TicketDetail({ ticket, deliverable, readOnly, onBack, onChoose }: { ticket: TicketWithOptions; deliverable: ClientDeliverable | null; readOnly: boolean; onBack: () => void; onChoose: (optionId: string) => void }) {
  const st = ticketStatus(ticket);
  const chosen = ticket.options.find((o) => o.chosen_at);
  return (
    <div style={container}>
      <Back onClick={onBack}>Help</Back>
      <H1 sub={[TICKET_KINDS.find((k) => k.key === ticket.kind)?.label, deliverable ? `about ${deliverable.title}` : null, `sent ${fmtDate(ticket.created_at)}`].filter(Boolean).join(' · ')}>{ticket.title}</H1>
      <div><Chip k={st.k}>{st.l}</Chip></div>
      <Card><span style={label}>Avoid</span><p style={body}>{ticket.avoid}</p><span style={label}>Prefer</span><p style={body}>{ticket.prefer}</p></Card>
      {ticket.status === 'open' && <Empty>Marq has this. You'll get two or three options to choose between here, not a single redo.</Empty>}
      {ticket.options.length > 0 && <>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{ticket.status === 'resolved' ? 'What you chose' : 'Pick one'}</span>
        {ticket.owner_note && <Card><p style={body}>{ticket.owner_note}</p></Card>}
        {ticket.options.map((o, i) => {
          const isChosen = !!o.chosen_at;
          return (
            <section key={o.id} style={{ ...cardS, opacity: ticket.status === 'resolved' && !isChosen ? 0.55 : 1, ...(isChosen ? { borderColor: 'color-mix(in srgb, var(--client-accent) 50%, var(--border))' } : {}) }}>
              <span style={label}>Option {i + 1}{isChosen ? ' · chosen' : ''}</span>
              <p style={body}>{o.body}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {o.link_url && <a href={o.link_url} target="_blank" rel="noreferrer" style={ghost}>See it</a>}
                {ticket.status === 'options_sent' && <button style={{ ...teal, ...off(readOnly) }} onClick={() => onChoose(o.id)}>Go with this one</button>}
              </div>
            </section>
          );
        })}
        {ticket.status === 'resolved' && !chosen && <span style={muted}>Closed by Marq.</span>}
      </>}
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
  const [deliverableId, setDeliverableId] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState<{ open: boolean; deliverable: ClientDeliverable | null }>({ open: false, deliverable: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // The portal is its own place: /portal in the address bar. Cosmetic;
  // App.tsx routes on role. Skipped in the owner's preview.
  useEffect(() => {
    if (!readOnly && window.location.pathname !== '/portal') window.history.replaceState(null, '', '/portal');
  }, [readOnly]);
  useEffect(() => {
    if (tab === 'help') data.markOwnerMessagesRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, messages.length]);

  if (data.loading) return <div style={page} />;
  if (!client) {
    return (
      <div style={page}><div style={scroll}><div style={container}>
        <Empty>Nothing set up for this login yet. Check back soon, or reach out to Marq.</Empty>
        {onSignOut && <button style={{ ...ghost, alignSelf: 'flex-start' }} onClick={onSignOut}>Sign out</button>}
      </div></div></div>
    );
  }

  const unreadFromOwner = messages.filter((m) => m.sender === 'owner' && !m.read_at).length;
  const awaiting = tickets.filter((t) => t.status === 'options_sent');
  const doneCount = modules.filter((m) => m.completed_at).length;
  const handoff = !!settings?.handoff_mode;
  const openGuide = modules.find((m) => m.id === guideId) ?? null;
  const openInvoice = invoices.find((i) => i.id === invoiceId) ?? null;
  const openTicket = tickets.find((t) => t.id === ticketId) ?? null;
  const openDeliverable = deliverables.find((d) => d.id === deliverableId) ?? null;
  const toReview = deliverables.filter((d) => d.status === 'review' && !d.approved_at);
  const unpaid = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const first = (client.contact_name ?? '').trim().split(/\s+/)[0] || client.business_name;
  const initials = client.business_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const activeIdx = spine.findIndex((s) => s.state === 'active');
  const curStation = spine[activeIdx >= 0 ? activeIdx : Math.max(0, spine.filter((s) => s.state === 'done').length - 1)];
  const nextStation = spine.find((s) => s.state === 'next');
  const needCount = toReview.length + awaiting.length + unpaid.length;

  const go = (t: Tab) => { setTab(t); setGuideId(null); setInvoiceId(null); setTicketId(null); setDeliverableId(null); setTicketForm({ open: false, deliverable: null }); };
  const startTicket = (d: ClientDeliverable | null) => { go('help'); setTicketForm({ open: true, deliverable: d }); };
  const send = async () => { if (!draft.trim()) return; setSending(true); await data.sendMessage(draft); setDraft(''); setSending(false); };

  const ask = (
    <Card title="Ask a quick question">
      <textarea style={{ ...input, minHeight: 64, resize: 'vertical' }} placeholder="Type your question…" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={small}>Goes straight to Marq. Want something changed? Open a ticket.</span>
        <button style={{ ...teal, height: 40, fontSize: 14, ...off(sending || !draft.trim() || readOnly) }} onClick={send}>{sending ? 'Sending…' : 'Send'}</button>
      </div>
    </Card>
  );

  const deliverableDetail = (d: ClientDeliverable) => {
    const chip = deliverableChip(d), needsOk = d.status === 'review' && !d.approved_at;
    return (
      <div style={container}>
        <Back onClick={() => setDeliverableId(null)}>Home</Back>
        <H1 sub={DELIVERABLE_KINDS.find((k) => k.key === d.kind)?.label ?? d.kind}>{d.title}</H1>
        <div><Chip k={chip.k}>{chip.l}</Chip></div>
        {d.what_it_is && <Card title="What it is"><p style={body}>{d.what_it_is}</p></Card>}
        {d.why_it_matters && <Card title="Why it matters for you"><p style={body}>{d.why_it_matters}</p></Card>}
        {d.link_url && <a href={d.link_url} target="_blank" rel="noreferrer" style={ghost}>Open it</a>}
        {needsOk && <>
          <button style={{ ...teal, ...off(readOnly) }} onClick={() => data.approveDeliverable(d.id)}>Looks good, approve</button>
          <button style={{ ...ghost, ...off(readOnly) }} onClick={() => startTicket(d)}>Ask for changes</button>
        </>}
        {d.status === 'review' && d.approved_at && <span style={muted}>You approved this {fmtDate(d.approved_at)}.</span>}
      </div>
    );
  };

  const renderHome = () => {
    if (openDeliverable) return deliverableDetail(openDeliverable);
    const need = toReview[0];
    return (
      <div style={container}>
        <H1 sub={needCount ? `${curStation ? `${curStation.label}: ${curStation.detail || 'in progress'}. ` : ''}${needCount === 1 ? 'One thing needs you.' : `${needCount} things need you.`}` : curStation ? `${curStation.label}. Nothing needs you right now.` : 'Nothing needs you right now.'}>Welcome back, {first}</H1>
        {need && (
          <Card accent>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--client-accent)' }}>Needs you{toReview.length > 1 ? ` · 1 of ${toReview.length}` : ''}</span>
            <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>Approve {need.title}</span>
            <span style={muted}>Take a look and approve, or tell us what to change. Nothing goes live until you approve.</span>
            <button style={teal} onClick={() => setDeliverableId(need.id)}>Review and approve</button>
          </Card>
        )}
        {!need && awaiting[0] && (
          <Card accent>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--client-accent)' }}>Needs you</span>
            <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>Pick an option: {awaiting[0].title}</span>
            <span style={muted}>Marq sent {awaiting[0].options.length} options. Choose the one you like.</span>
            <button style={teal} onClick={() => { go('help'); setTicketId(awaiting[0].id); }}>See the options</button>
          </Card>
        )}
        {spine.length > 0 && (
          <Card title="Where we are" meta={curStation ? `Step ${spine.indexOf(curStation) + 1} of ${spine.length}` : undefined}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${spine.length},1fr)`, gap: 4 }}>
              {spine.map((s) => <div key={s.key} style={{ height: 6, borderRadius: 3, background: s.state === 'done' ? 'var(--client-accent)' : s.state === 'active' ? 'color-mix(in srgb, var(--client-accent) 45%, var(--surface-3))' : 'var(--surface-3)' }} />)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text)' }}>{curStation?.label}</span>{nextStation && <span>Next: {nextStation.label}</span>}
            </div>
          </Card>
        )}
        {handoff && (
          <Card title="You're running this now" meta={modules.length ? `${doneCount} of ${modules.length} guides` : undefined} accent>
            <span style={muted}>{modules.length ? 'Short guides for the parts you own.' : 'Your guides are being assigned.'}{settings?.handoff_checkin_on ? ` Marq checks in on ${settings.handoff_checkin_on}.` : ''}</span>
            {modules.length > 0 && <button style={teal} onClick={() => go('progress')}>Open the guides</button>}
          </Card>
        )}
        <Card title="What we built" meta={deliverables.length ? `${deliverables.length} ${deliverables.length === 1 ? 'piece' : 'pieces'}` : undefined} flush>
          {deliverables.length ? <div>{deliverables.map((d, i) => { const c = deliverableChip(d); return <Row key={d.id} first={i === 0} name={d.title} meta={DELIVERABLE_KINDS.find((k) => k.key === d.kind)?.label ?? d.kind} chip={c.l} k={c.k} onClick={() => setDeliverableId(d.id)} />; })}</div>
            : <span style={{ ...muted, paddingBottom: 14 }}>Nothing delivered yet. Each piece shows up here with what it is and why it matters for {client.business_name}.</span>}
        </Card>
        {settings?.welcome_text && <Card title="From Marq"><p style={body}>{settings.welcome_text}</p></Card>}
        {settings?.next_steps && <Card title="What happens next"><p style={body}>{settings.next_steps}</p></Card>}
        {ask}
      </div>
    );
  };

  const renderProgress = () => {
    if (openGuide) return <GuideDetail item={openGuide} readOnly={readOnly} onBack={() => setGuideId(null)} onToggleDone={(done) => data.setCompleted(openGuide.id, done)} />;
    return (
      <div style={container}>
        <H1 sub={`Where things stand for ${client.business_name}`}>Progress</H1>
        <Card title="Where we are"><ProgressSpine stations={spine} /></Card>
        <Card title="How to run it" meta={modules.length ? `${doneCount} of ${modules.length} done` : undefined} flush>
          {modules.length ? <div>{modules.map((m, i) => <Row key={m.id} first={i === 0} name={m.module.title} meta={`${m.module.steps.length} steps${m.module.video_url ? ' · video' : ''}`} chip={m.completed_at ? 'Done' : m.opened_at ? 'Started' : 'New'} k={m.completed_at ? 'good' : m.opened_at ? 'client' : 'neutral'} onClick={() => { setGuideId(m.id); data.markOpened(m.id); }} />)}</div>
            : <span style={{ ...muted, paddingBottom: 14 }}>No guides yet. They're matched to what was built for you and show up as each piece goes live.</span>}
        </Card>
        <Card title="What's changed" meta={changelog.length ? `${changelog.length}` : undefined}>
          {changelog.length ? changelog.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', gap: 14, paddingTop: i ? 12 : 0, borderTop: i ? '1px solid var(--grid)' : 'none' }}>
              <span style={{ ...small, width: 48, flex: 'none', paddingTop: 2 }}>{fmtDate(e.happened_on)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', overflowWrap: 'anywhere' }}>{e.what}</div>
                {e.why && <div style={{ ...muted, marginTop: 2, overflowWrap: 'anywhere' }}>{e.why}</div>}
              </div>
            </div>
          )) : <span style={muted}>Nothing logged yet. The first line lands here the moment something ships.</span>}
        </Card>
        <Card title="How this works">
          <p style={{ ...body, fontSize: 14, color: 'var(--text-secondary)' }}>Made by Marq builds it, then teaches you to run it. Strategy and the build stay with Marq. The day-to-day (taking payments, posting, answering reviews, reading your numbers) is handed to you one short guide at a time, so you're never stuck waiting on anyone for the parts you can own.</p>
        </Card>
      </div>
    );
  };

  const renderNumbers = () => {
    if (openInvoice) {
      return (
        <div style={container}>
          <Back onClick={() => setInvoiceId(null)}>Numbers</Back>
          <InvoiceDocument
            from={data.providerProfile?.business_name || undefined} businessAddress={data.providerProfile?.business_address || undefined}
            businessEmail={data.providerProfile?.business_email || undefined} businessPhone={data.providerProfile?.business_phone || undefined}
            businessWebsite={data.providerProfile?.website || undefined} billTo={client.business_name} description={openInvoice.description}
            amount={openInvoice.amount} dueDate={openInvoice.due_date} invoiceNumber={openInvoice.invoice_number} status={openInvoice.status} paidAt={openInvoice.paid_at}
          />
          {openInvoice.status !== 'paid' && openInvoice.status !== 'void' && openInvoice.stripe_invoice_url && <a href={openInvoice.stripe_invoice_url} target="_blank" rel="noreferrer" style={teal}>Pay now</a>}
        </div>
      );
    }
    const latest = reports[reports.length - 1];
    return (
      <div style={container}>
        <H1 sub={latest ? `${latest.period_label} · updated ${fmtDate(latest.updated_at)}` : 'Monthly reports land here'}>Your numbers</H1>
        <Numbers reports={reports} />
        <Card title="Invoices" meta={unpaid.length ? `${unpaid.length} due` : invoices.length ? 'All paid' : undefined} flush>
          {invoices.length ? <div>{invoices.map((inv, i) => { const c = invoiceChip(inv.status); return <Row key={inv.id} first={i === 0} name={inv.description} meta={inv.due_date ? `Due ${fmtDate(inv.due_date)}` : `#${inv.invoice_number}`} chip={c.l} k={c.k} amt={money(Number(inv.amount) || 0)} dim={inv.status === 'paid' || inv.status === 'void'} onClick={() => setInvoiceId(inv.id)} />; })}</div>
            : <span style={{ ...muted, paddingBottom: 14 }}>Nothing sent yet.</span>}
        </Card>
      </div>
    );
  };

  const renderHelp = () => {
    if (ticketForm.open) {
      return <TicketForm deliverables={deliverables} presetDeliverable={ticketForm.deliverable} readOnly={readOnly} onCancel={() => setTicketForm({ open: false, deliverable: null })}
        onSubmit={async (input) => { const err = await data.fileTicket(input); if (!err) setTicketForm({ open: false, deliverable: null }); return err; }} />;
    }
    if (openTicket) return <TicketDetail ticket={openTicket} deliverable={deliverables.find((d) => d.id === openTicket.deliverable_id) ?? null} readOnly={readOnly} onBack={() => setTicketId(null)} onChoose={(optionId) => data.chooseOption(openTicket.id, optionId)} />;
    return (
      <div style={container}>
        <H1 sub="Quick questions go to Messages. Changes go in a ticket, and you get two or three options back.">Help</H1>
        <button style={teal} onClick={() => startTicket(null)}>New ticket</button>
        <Card title="Tickets" meta={tickets.length ? `${tickets.length}` : undefined} flush>
          {tickets.length ? <div>{tickets.map((t, i) => { const st = ticketStatus(t); return <Row key={t.id} first={i === 0} name={t.title} meta={[TICKET_KINDS.find((k) => k.key === t.kind)?.label, fmtDate(t.created_at), t.status === 'options_sent' ? `${t.options.length} options` : null].filter(Boolean).join(' · ')} chip={st.l} k={st.k} onClick={() => setTicketId(t.id)} />; })}</div>
            : <span style={{ ...muted, paddingBottom: 14 }}>No tickets yet.</span>}
        </Card>
        <Card title="Messages" meta={messages.length ? `${messages.length}` : undefined}>
          {messages.length === 0 && <span style={muted}>No messages yet. Ask anything: a question, a problem, a photo you want on the site.</span>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((m) => {
              const mine = m.sender === 'client';
              return (
                <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: mine ? 'color-mix(in srgb, var(--client-accent) 18%, var(--surface))' : 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--text)' }}>{m.body}</div>
                  <div style={{ ...small, marginTop: 4 }}>{mine ? 'You' : 'Marq'} · {new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea style={{ ...input, minHeight: 48, maxHeight: 160, resize: 'vertical', flex: 1 }} placeholder="Write a message…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button style={{ ...teal, ...off(sending || !draft.trim() || readOnly) }} onClick={send}>Send</button>
          </div>
        </Card>
        {onSignOut && !readOnly && <button style={{ ...ghost, color: 'var(--danger)' }} onClick={onSignOut}>Sign out</button>}
      </div>
    );
  };

  const tabs: { key: Tab; label: string; badge: number; icon: ReactNode }[] = [
    { key: 'home', label: 'Home', badge: toReview.length, icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /> },
    { key: 'progress', label: 'Progress', badge: handoff && modules.length ? modules.length - doneCount : 0, icon: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></> },
    { key: 'numbers', label: 'Numbers', badge: unpaid.length, icon: <path d="M5 20V10M12 20V4M19 20v-7" /> },
    { key: 'help', label: 'Help', badge: awaiting.length + unreadFromOwner, icon: <><circle cx="12" cy="12" r="8" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01" /></> },
  ];

  return (
    <div style={page}>
      {readOnly && (
        <div style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12.5, fontWeight: 500, color: 'var(--client-accent)', background: 'color-mix(in srgb, var(--client-accent) 10%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--client-accent) 30%, transparent)' }}>
          Preview: exactly what {client.business_name} sees. Actions are off here.
        </div>
      )}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {settings?.logo_url
            ? <img src={settings.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
            : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--client-accent) 20%, var(--surface-3))', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{initials}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
            <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.business_name}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5, fontWeight: 500 }}>Client portal · by MARQ</span>
          </div>
        </div>
      </div>
      <div style={scroll}>
        {tab === 'home' && renderHome()}
        {tab === 'progress' && renderProgress()}
        {tab === 'numbers' && renderNumbers()}
        {tab === 'help' && renderHelp()}
      </div>
      <nav style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', zIndex: 10 }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => go(t.key)} aria-current={active ? 'page' : undefined} style={{ flex: 1, height: TAB_BAR, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', color: active ? 'var(--text)' : 'var(--text-tertiary)', position: 'relative', minWidth: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--client-accent)' : 'var(--text-tertiary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
              <span style={{ fontSize: 11, fontWeight: 500 }}>{t.label}</span>
              {t.badge > 0 && <span style={{ position: 'absolute', top: 8, left: 'calc(50% + 6px)', minWidth: 16, height: 16, borderRadius: 8, background: 'var(--client-accent)', color: 'var(--bg)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{t.badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
