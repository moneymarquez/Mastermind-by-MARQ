import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSupportInbox } from '../../data/useSupportInbox';
import type { SupportInboxEntry } from '../../data/useSupportInbox';
import { INBOX_DOMAINS, inboxBucket } from '../../data/inboxAddresses';
import { supabase } from '../../lib/supabase';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onOpenClient: (clientId: string) => void;
}

type TicketStatus = 'open' | 'options_sent' | 'resolved';

interface TicketRow {
  id: string;
  title: string;
  kind: string;
  avoid: string;
  prefer: string;
  owner_note: string | null;
  status: TicketStatus;
  created_at: string;
  client_id: string;
  crm_clients: { business_name: string } | null;
}

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', options_sent: 'Options sent', resolved: 'Resolved' };
const TICKET_STATUS_COLOR: Record<TicketStatus, string> = { open: 'var(--warning)', options_sent: 'var(--text-secondary)', resolved: 'var(--success)' };

// Structured feedback tickets filed from the client portal — briefly had
// their own sidebar widget, but that ate into the vertical room the nav
// list needs, so they're browsable here instead, next to the mail filters.
function useTicketsBrowse() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('client_tickets')
      .select('id, title, kind, avoid, prefer, owner_note, status, created_at, client_id, crm_clients(business_name)')
      .order('created_at', { ascending: false });
    setTickets((data ?? []) as unknown as TicketRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: TicketStatus) => {
    await supabase.from('client_tickets').update({ status }).eq('id', id);
    await load();
  };

  return { tickets, loading, setStatus };
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const ghostBtn: CSSProperties = {
  padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent',
  color: 'var(--text-quaternary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const activeChip: CSSProperties = { background: 'var(--text)', color: 'var(--bg)', border: 'none' };
const addrTag: CSSProperties = { fontSize: 'var(--text-nano)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 7px', whiteSpace: 'nowrap' };

const CATEGORY_COLOR: Record<string, string> = {
  lead: 'var(--success)', billing: 'var(--warning)', support: 'var(--success)', bug: 'var(--danger)', general: 'var(--text-secondary)', spam: 'var(--text-tertiary)',
};

function StatusPill({ status }: { status: SupportInboxEntry['status'] }) {
  const colors: Record<SupportInboxEntry['status'], string> = { new: 'var(--warning)', reviewed: 'var(--text-secondary)', replied: 'var(--success)', ignored: 'var(--text-tertiary)' };
  const c = colors[status];
  return (
    <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: `${c}22`, border: `1px solid ${c}55`, color: c, fontSize: 'var(--text-nano)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

function TicketStatusPill({ status }: { status: TicketStatus }) {
  const c = TICKET_STATUS_COLOR[status];
  return (
    <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: `${c}22`, border: `1px solid ${c}55`, color: c, fontSize: 'var(--text-nano)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
      {TICKET_STATUS_LABEL[status]}
    </span>
  );
}

/** Mail from both domains, categorized by the address it came in on
 *  (src/data/inboxAddresses.ts) on top of the status filter. Domain chips
 *  first, then that domain's addresses with live counts — an address that
 *  isn't in the list still appears under its raw local part, so nothing
 *  routed to an address you haven't listed yet gets hidden. A "Tickets"
 *  chip sits right next to "Both domains" so client feedback tickets are
 *  still fully browsable here even though they no longer get their own
 *  sidebar widget. */
export default function SupportInboxScreen({ homeHeadStyle, homeSubStyle, onOpenClient }: Props) {
  const { entries, loading, setStatus } = useSupportInbox();
  const [filter, setFilter] = useState<'all' | SupportInboxEntry['status']>('new');
  const [domainKey, setDomainKey] = useState<string>('all');
  const [local, setLocal] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { tickets, loading: ticketsLoading, setStatus: setTicketStatus } = useTicketsBrowse();
  const [ticketFilter, setTicketFilter] = useState<'all' | TicketStatus>('open');

  const bucketed = useMemo(() => entries.map((e) => ({ e, b: inboxBucket(e.to_email) })), [entries]);
  const byStatus = bucketed.filter(({ e }) => filter === 'all' || e.status === filter);
  const byDomain = byStatus.filter(({ b }) => domainKey === 'all' || b.domainKey === domainKey);
  const filtered = byDomain.filter(({ b }) => local === 'all' || b.local === local).map(({ e }) => e);

  const filteredTickets = tickets.filter((t) => ticketFilter === 'all' || t.status === ticketFilter);
  const ticketsNeedingAttention = tickets.filter((t) => t.status !== 'resolved').length;

  const showingTickets = domainKey === 'tickets';

  // Address chips for the chosen domain: the configured list (even at 0)
  // plus any unlisted local parts that have actually received mail.
  const domain = INBOX_DOMAINS.find((d) => d.key === domainKey) ?? null;
  const addressChips: { local: string; label: string; purpose: string; count: number }[] = domain
    ? [
        ...domain.addresses.map((a) => ({ local: a.local, label: a.label, purpose: a.purpose, count: byDomain.filter(({ b }) => b.local === a.local).length })),
        ...[...new Set(byDomain.filter(({ b }) => !b.known).map(({ b }) => b.local))].map((l) => ({ local: l, label: l, purpose: 'Not in the address list yet', count: byDomain.filter(({ b }) => b.local === l).length })),
      ]
    : [];

  const copyDraft = async (entry: SupportInboxEntry) => {
    if (!entry.ai_draft_reply) return;
    try {
      await navigator.clipboard.writeText(entry.ai_draft_reply);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard access can fail silently on some browsers/contexts — the
      // draft is still visible on screen to select and copy by hand.
    }
  };

  return (
    <div>
      <div style={homeHeadStyle}>Support Inbox</div>
      <div style={homeSubStyle}>
        Mail sent to any address on mastermindsbymarq.com or madebymarquez.com, tagged by the address it came in on and
        auto-categorized with a drafted reply — nothing here is ever sent without you reviewing and sending it yourself.
      </div>

      {!showingTickets && (
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          {(['new', 'reviewed', 'replied', 'ignored', 'all'] as const).map((f) => (
            <div key={f} style={{ ...ghostBtn, ...(filter === f ? activeChip : {}) }} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)} ({f === 'all' ? entries.length : entries.filter((e) => e.status === f).length})
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginRight: 2 }}>Sent to</span>
        <div style={{ ...ghostBtn, ...(domainKey === 'all' ? activeChip : {}) }} onClick={() => { setDomainKey('all'); setLocal('all'); }}>Both domains ({byStatus.length})</div>
        <div style={{ ...ghostBtn, ...(showingTickets ? activeChip : {}) }} onClick={() => { setDomainKey('tickets'); setLocal('all'); }}>Tickets ({ticketsNeedingAttention})</div>
        {INBOX_DOMAINS.map((d) => (
          <div key={d.key} style={{ ...ghostBtn, ...(domainKey === d.key ? activeChip : {}) }} onClick={() => { setDomainKey(d.key); setLocal('all'); }}>
            {d.label} ({byStatus.filter(({ b }) => b.domainKey === d.key).length})
          </div>
        ))}
        {byStatus.some(({ b }) => b.domainKey === 'other') && (
          <div style={{ ...ghostBtn, ...(domainKey === 'other' ? activeChip : {}) }} onClick={() => { setDomainKey('other'); setLocal('all'); }}>
            Other ({byStatus.filter(({ b }) => b.domainKey === 'other').length})
          </div>
        )}
      </div>

      {domain && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ ...ghostBtn, ...(local === 'all' ? activeChip : {}) }} onClick={() => setLocal('all')}>Every address ({byDomain.length})</div>
          {addressChips.map((a) => (
            <div key={a.local} title={a.purpose} style={{ ...ghostBtn, ...(local === a.local ? activeChip : {}), opacity: a.count || local === a.local ? 1 : 0.55 }} onClick={() => setLocal(a.local)}>
              {a.local}@ ({a.count})
            </div>
          ))}
          {domain.addresses.length === 0 && (
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>No addresses listed for {domain.domain} yet — add them in src/data/inboxAddresses.ts.</span>
          )}
        </div>
      )}
      {domain && local !== 'all' && (
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 6 }}>
          {local}@{domain.domain} — {addressChips.find((a) => a.local === local)?.purpose}
        </div>
      )}

      {showingTickets && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {(['open', 'options_sent', 'resolved', 'all'] as const).map((f) => (
            <div key={f} style={{ ...ghostBtn, ...(ticketFilter === f ? activeChip : {}) }} onClick={() => setTicketFilter(f)}>
              {f === 'all' ? 'All' : TICKET_STATUS_LABEL[f]} ({f === 'all' ? tickets.length : tickets.filter((t) => t.status === f).length})
            </div>
          ))}
        </div>
      )}

      {showingTickets ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 680 }}>
          {!ticketsLoading && filteredTickets.length === 0 && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing here.</div>
          )}
          {filteredTickets.map((t) => (
            <div key={t.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{t.title}</div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3 }}>{t.crm_clients?.business_name ?? 'Client'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {t.kind && <span style={addrTag}>{t.kind}</span>}
                  <TicketStatusPill status={t.status} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 'var(--text-nano)', letterSpacing: 0.3, marginRight: 6 }}>Avoid</span>
                  {t.avoid}
                </div>
                <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 'var(--text-nano)', letterSpacing: 0.3, marginRight: 6 }}>Prefer</span>
                  {t.prefer}
                </div>
              </div>

              {t.owner_note && (
                <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-2)', border: '1px solid var(--surface-3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Your note</div>
                  <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.owner_note}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <div style={ghostBtn} onClick={() => onOpenClient(t.client_id)}>Open client</div>
                {t.status !== 'options_sent' && <div style={ghostBtn} onClick={() => setTicketStatus(t.id, 'options_sent')}>Mark options sent</div>}
                {t.status !== 'resolved' && <div style={ghostBtn} onClick={() => setTicketStatus(t.id, 'resolved')}>Mark resolved</div>}
                {t.status !== 'open' && <div style={ghostBtn} onClick={() => setTicketStatus(t.id, 'open')}>Reopen</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 680 }}>
          {!loading && filtered.length === 0 && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing here.</div>
          )}
          {filtered.map((e) => {
            const b = inboxBucket(e.to_email);
            return (
              <div key={e.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{e.subject || '(no subject)'}</div>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3, overflowWrap: 'anywhere' }}>{e.from_email} → {e.to_email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={addrTag} title={b.domainLabel}>{b.domainShort} · {b.local}@</span>
                    {e.category && (
                      <span style={{ fontSize: 'var(--text-micro)', color: CATEGORY_COLOR[e.category] ?? 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        {e.category}
                      </span>
                    )}
                    <StatusPill status={e.status} />
                  </div>
                </div>

                {e.body_text && (
                  <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.5, maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                    {e.body_text}
                  </div>
                )}

                {e.ai_draft_reply && (
                  <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-2)', border: '1px solid var(--surface-3)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Drafted reply</div>
                    <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.ai_draft_reply}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {e.ai_draft_reply && <div style={ghostBtn} onClick={() => copyDraft(e)}>{copiedId === e.id ? 'Copied ✓' : 'Copy draft'}</div>}
                  <a href={`mailto:${e.from_email}?subject=${encodeURIComponent(`Re: ${e.subject || ''}`)}`} style={{ ...ghostBtn, textDecoration: 'none' }}>Reply from {b.local}@</a>
                  {e.status !== 'reviewed' && <div style={ghostBtn} onClick={() => setStatus(e.id, 'reviewed')}>Mark reviewed</div>}
                  {e.status !== 'replied' && <div style={ghostBtn} onClick={() => setStatus(e.id, 'replied')}>Mark replied</div>}
                  {e.status !== 'ignored' && <div style={ghostBtn} onClick={() => setStatus(e.id, 'ignored')}>Ignore</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
