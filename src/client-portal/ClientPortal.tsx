import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientPortalData } from '../data/useClientPortalData';
import type { AssignedModule } from '../data/useClientPortalData';
import type { ClientInvoice, ClientReport } from '../data/types';
import { DELIVERABLE_KINDS } from '../data/types';
import InvoiceDocument, { money } from '../components/InvoiceDocument';

interface Props {
  onSignOut: () => void;
}

type Tab = 'home' | 'guides' | 'invoices' | 'messages';

// ── Styles ─────────────────────────────────────────────────────────────
// Mobile first: one column, 16px inputs, content padded past the tab bar
// plus the safe-area inset (additive, never carved out of a fixed height).
const TAB_BAR = 64;
const page: CSSProperties = { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' };
const scroll: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `24px 18px calc(${TAB_BAR + 28}px + env(safe-area-inset-bottom))` };
const container: CSSProperties = { maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 };
const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-label)', fontWeight: 700, color: 'var(--text)', margin: '20px 0 4px' };
const muted: CSSProperties = { fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', lineHeight: 1.55 };
const body: CSSProperties = { fontSize: 'var(--text-body)', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' };
const primaryBtn: CSSProperties = { padding: '12px 20px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' };
const ghostBtn: CSSProperties = { padding: '9px 15px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 };
const pill = (color: string): CSSProperties => ({ fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)', padding: '3px 9px', color, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, whiteSpace: 'nowrap' });

function invoiceColor(status: ClientInvoice['status']): string {
  if (status === 'paid') return 'var(--success)';
  if (status === 'void') return 'var(--text-tertiary)';
  return 'var(--danger)';
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
function GuideDetail({ item, onBack, onToggleDone }: { item: AssignedModule; onBack: () => void; onToggleDone: (done: boolean) => void }) {
  const m = item.module;
  const done = !!item.completed_at;
  return (
    <div style={container}>
      <span style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={onBack}>← All guides</span>
      <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, marginTop: 6 }}>{m.title}</div>
      <div style={card}>
        <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 'var(--text-micro)', fontWeight: 700 }}>What it is</div>
        <div style={{ ...body, marginTop: 4 }}>{m.what_it_is}</div>
        <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 'var(--text-micro)', fontWeight: 700, marginTop: 14 }}>Why it matters</div>
        <div style={{ ...body, marginTop: 4 }}>{m.why_it_matters}</div>
      </div>
      {m.video_url && (
        <a href={m.video_url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, alignSelf: 'flex-start' }}>▶ Watch the 90-second walkthrough</a>
      )}
      <div style={card}>
        <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 'var(--text-micro)', fontWeight: 700, marginBottom: 8 }}>Steps</div>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {m.steps.map((s, i) => <li key={i} style={{ ...body, fontSize: 'var(--text-body)' }}>{s}</li>)}
        </ol>
      </div>
      <div style={{ ...card, borderColor: done ? 'color-mix(in srgb, var(--success) 45%, transparent)' : 'var(--border)' }}>
        <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 'var(--text-micro)', fontWeight: 700 }}>You're done when</div>
        <div style={{ ...body, marginTop: 4 }}>{m.done_when}</div>
        <div style={{ ...(done ? ghostBtn : primaryBtn), marginTop: 14 }} onClick={() => onToggleDone(!done)}>{done ? 'Done ✓ — tap to undo' : 'Mark done'}</div>
      </div>
    </div>
  );
}

// ── Portal ─────────────────────────────────────────────────────────────
export default function ClientPortal({ onSignOut }: Props) {
  const data = useClientPortalData();
  const { client, settings, deliverables, modules, messages, invoices, reports } = data;
  const [tab, setTab] = useState<Tab>('home');
  const [guideId, setGuideId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // The portal is its own place: /portal in the address bar, nothing of
  // the owner tool. Cosmetic — App.tsx routes on role, not path.
  useEffect(() => {
    if (window.location.pathname !== '/portal') window.history.replaceState(null, '', '/portal');
  }, []);

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
            <span style={{ ...ghostBtn, alignSelf: 'flex-start' }} onClick={onSignOut}>Sign out</span>
          </div>
        </div>
      </div>
    );
  }

  const unreadFromOwner = messages.filter((m) => m.sender === 'owner' && !m.read_at).length;
  const doneCount = modules.filter((m) => m.completed_at).length;
  const handoff = !!settings?.handoff_mode;
  const openGuide = modules.find((m) => m.id === guideId) ?? null;
  const openInvoice = invoices.find((i) => i.id === invoiceId) ?? null;

  const openGuideAt = (item: AssignedModule) => {
    setGuideId(item.id);
    data.markOpened(item.id);
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
        <span style={{ ...muted, cursor: 'pointer', flexShrink: 0 }} onClick={onSignOut}>Sign out</span>
      </div>

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

      {settings && settings.timeline.length > 0 && (
        <div style={card}>
          <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 'var(--text-micro)', fontWeight: 700, marginBottom: 8 }}>Timeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {settings.timeline.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ color: t.done ? 'var(--success)' : 'var(--text-tertiary)', fontWeight: 700, flexShrink: 0 }}>{t.done ? '✓' : '○'}</span>
                <span style={{ fontSize: 'var(--text-body)', color: t.done ? 'var(--text-secondary)' : 'var(--text)', flex: 1 }}>{t.label}</span>
                {t.date && <span style={muted}>{t.date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {settings?.next_steps && (
        <div style={card}>
          <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 'var(--text-micro)', fontWeight: 700 }}>What happens next</div>
          <div style={{ ...body, marginTop: 4 }}>{settings.next_steps}</div>
        </div>
      )}

      <div style={sectionTitle}>What we built</div>
      {deliverables.length === 0 && <Empty>Nothing delivered yet — each piece shows up here with what it is and why it matters for {client.business_name}.</Empty>}
      {deliverables.map((d) => {
        const color = d.status === 'live' ? 'var(--success)' : d.status === 'review' ? 'var(--warning)' : 'var(--text-tertiary)';
        return (
          <div key={d.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...muted, fontSize: 'var(--text-micro)', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>{DELIVERABLE_KINDS.find((k) => k.key === d.kind)?.label ?? d.kind}</div>
                <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, marginTop: 2 }}>{d.title}</div>
              </div>
              <span style={pill(color)}>{d.status === 'in_progress' ? 'in progress' : d.status}</span>
            </div>
            {d.what_it_is && <div style={{ ...body, marginTop: 10 }}>{d.what_it_is}</div>}
            {d.why_it_matters && (
              <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid var(--border-2)' }}>
                <div style={{ ...muted, fontSize: 'var(--text-micro)', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>Why it matters for you</div>
                <div style={{ ...body, marginTop: 2, fontSize: 'var(--text-body-sm)' }}>{d.why_it_matters}</div>
              </div>
            )}
            {d.link_url && <a href={d.link_url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, marginTop: 12 }}>Open ↗</a>}
          </div>
        );
      })}

      <div style={sectionTitle}>Your numbers</div>
      <Numbers reports={reports} />
    </div>
  );

  const renderGuides = () => {
    if (openGuide) return <GuideDetail item={openGuide} onBack={() => setGuideId(null)} onToggleDone={(done) => data.setCompleted(openGuide.id, done)} />;
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
      <div style={muted}>One place for everything about your project. Marq sees these right away.</div>
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
        <span style={{ ...primaryBtn, opacity: sending || !draft.trim() ? 0.6 : 1, pointerEvents: sending || !draft.trim() ? 'none' : 'auto' }} onClick={send}>Send</span>
      </div>
    </div>
  );

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'home', label: 'Home' },
    { key: 'guides', label: 'Guides', badge: handoff && modules.length ? modules.length - doneCount : 0 },
    { key: 'invoices', label: 'Invoices', badge: invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length },
    { key: 'messages', label: 'Messages', badge: unreadFromOwner },
  ];

  return (
    <div style={page}>
      <div style={scroll}>
        {tab === 'home' && renderHome()}
        {tab === 'guides' && renderGuides()}
        {tab === 'invoices' && renderInvoices()}
        {tab === 'messages' && renderMessages()}
      </div>
      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--surface-2)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', zIndex: 10 }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <div key={t.key} onClick={() => { setTab(t.key); setGuideId(null); setInvoiceId(null); }} style={{ flex: 1, height: TAB_BAR, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: active ? 'var(--text)' : 'var(--text-tertiary)', position: 'relative' }}>
              <div style={{ width: 22, height: 3, borderRadius: 2, background: active ? 'var(--text)' : 'transparent' }} />
              <span style={{ fontSize: 'var(--text-body-sm)', fontWeight: active ? 700 : 500 }}>{t.label}</span>
              {!!t.badge && (
                <span style={{ position: 'absolute', top: 12, right: 'calc(50% - 30px)', minWidth: 18, height: 18, borderRadius: 9, background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{t.badge}</span>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
