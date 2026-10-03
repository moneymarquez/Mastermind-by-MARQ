import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useUnifiedInbox } from '../../../data/useUnifiedInbox';
import type { UMsg } from '../../../data/useUnifiedInbox';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, useModule, NovaMark } from '../../mm/Page';
import { initials, shortDate, ymd } from './util';

type Filter = 'open' | 'drafts' | 'tickets' | 'all';
const when = (iso: string) => { const d = ymd(new Date(iso)); return d === ymd(new Date()) ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : shortDate(d); };
function chipFor(m: UMsg): { c: string; k: ChipKind } {
  const kind = m.kind === 'ticket' ? 'Ticket' : m.kind === 'message' ? 'Question' : m.sort ?? 'Mail';
  if (m.replied) return { c: 'Replied', k: 'good' };
  if (m.draft) return { c: `${kind} · draft ready`, k: 'accent' };
  return { c: kind, k: m.kind === 'mail' ? 'neutral' : 'client' };
}

export default function SupportInboxV2({ onOpenClient }: { onOpenClient: (id: string) => void }) {
  const { device } = useModule();
  const phone = device === 'phone';
  const U = useUnifiedInbox(true);
  const [filter, setFilter] = useState<Filter>('open');
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const open = U.msgs.filter((m) => !m.replied);
  const list = U.msgs.filter((m) => (filter === 'all' || (filter === 'open' && !m.replied) || (filter === 'drafts' && !!m.draft && !m.replied) || (filter === 'tickets' && m.kind === 'ticket'))
    && (!q || `${m.sender} ${m.org ?? ''} ${m.subject}`.toLowerCase().includes(q.toLowerCase())));
  useEffect(() => { if (!phone && !sel && list[0]) setSel(list[0].id); }, [phone, sel, list]);
  const cur = U.msgs.find((m) => m.id === sel) ?? null;
  useEffect(() => { if (cur) void U.markRead(cur); }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!U.loading && U.msgs.length === 0) {
    return <Page title="Support Inbox" sub="Mail, portal tickets and questions"><Empty text="You're caught up. Nothing is waiting on a reply." /></Page>;
  }
  const counts: Record<Filter, number> = { open: open.length, drafts: open.filter((m) => m.draft).length, tickets: U.msgs.filter((m) => m.kind === 'ticket').length, all: U.msgs.length };

  const listPane = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', flex: 'none' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search support" aria-label="Search support" style={{ height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['open', 'drafts', 'tickets', 'all'] as Filter[]).map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 999, border: filter === f ? '1px solid var(--text)' : '1px solid var(--border)', background: filter === f ? 'var(--text)' : 'transparent', color: filter === f ? 'var(--bg)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{f[0].toUpperCase() + f.slice(1)} {counts[f]}</button>)}
        </div>
      </div>
      <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>
        {list.map((m) => { const ch = chipFor(m); return (
          <button key={m.id} onClick={() => setSel(m.id)} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid var(--grid)', background: cur?.id === m.id && !phone ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', minHeight: 60 }}>
            <div style={{ position: 'relative', width: 32, height: 32, flex: 'none', borderRadius: '50%', background: m.portal ? 'color-mix(in srgb, var(--client-accent) 18%, var(--surface-3))' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 11.5, fontWeight: 600 }}>{initials(m.org ?? m.sender)}{m.unread && <span style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface)' }} />}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text)', fontSize: 14, fontWeight: m.unread ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.org ?? m.sender}</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{when(m.at)}</span></div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.subject}</span>
              <div style={{ display: 'flex', gap: 6, minWidth: 0 }}><Chip k={ch.k}>{ch.c}</Chip></div>
            </div>
          </button>
        ); })}
        {list.length === 0 && <div style={{ padding: '18px 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing here.</div>}
      </div>
    </div>
  );
  const detail = cur ? <Detail key={cur.id} m={cur} U={U} onBack={phone ? () => setSel(null) : undefined} onOpenClient={onOpenClient} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Pick one on the left.</div>;

  return (
    <Page title="Support Inbox" sub="Mail, portal tickets and questions">
      {phone ? <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{cur ? detail : listPane}</section> : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? '380px minmax(0,1fr)' : '320px minmax(0,1fr)', height: 'calc(100vh - 330px)', minHeight: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>{listPane}{detail}</section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Open" value={String(open.length)} pill={`${open.filter((m) => m.unread).length} unread`} k={open.some((m) => m.unread) ? 'warn' : 'neutral'} />
            <Stat label="Drafts ready" value={String(counts.drafts)} pill="Waiting on Send" />
            <Stat label="Tickets" value={String(counts.tickets)} pill="From the portal" />
            <Stat label="Replied" value={String(U.msgs.filter((m) => m.replied).length)} pill="In this list" k={U.msgs.some((m) => m.replied) ? 'good' : 'neutral'} />
          </div>
        </>
      )}
    </Page>
  );
}

function Detail({ m, U, onBack, onOpenClient }: { m: UMsg; U: ReturnType<typeof useUnifiedInbox>; onBack?: () => void; onOpenClient: (id: string) => void }) {
  const [text, setText] = useState(m.draft ?? '');
  const [editing, setEditing] = useState(!m.draft);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(m.replied ? { t: 'Replied.' } : null);
  const ch = chipFor(m);
  const send = async () => {
    setBusy(true);
    const r = await U.send(m, text);
    setBusy(false);
    setMsg(r.ok ? { t: 'Sent just now.' } : { t: r.error ?? 'Could not send.', bad: true });
  };
  const ticket = async (status: string) => { await supabase.from('client_tickets').update({ status }).eq('id', m.rawId); await U.reload(); };
  const mailStatus = async (status: string) => { await supabase.from('support_inbox').update({ status }).eq('id', m.rawId); await U.reload(); };
  return (
    <div className="mm-scroll-y" style={{ minWidth: 0, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: onBack ? 18 : '22px 26px' }}>
        {onBack && <button className="mm-btn" onClick={onBack} style={{ alignSelf: 'flex-start', height: 34 }}>‹ Support Inbox</button>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.25 }}>{m.subject}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '1px 7px', borderRadius: 4, border: `1px solid ${m.portal ? 'var(--client-accent)' : 'var(--border)'}`, color: m.portal ? 'var(--client-accent)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{m.sourceLabel}</span>
            <Chip k={ch.k}>{ch.c}</Chip>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{initials(m.sender)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{m.sender}{m.org ? ` · ${m.org}` : ''}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', overflowWrap: 'anywhere' }}>{m.fromAddr ? `${m.fromAddr} → ${m.toAddr}` : 'Client portal'} · {new Date(m.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </div>
        {m.body && m.body !== m.subject && <p style={{ margin: 0, color: 'var(--text)', fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.body}</p>}
        {m.kind === 'ticket' && (
          <div style={{ display: 'grid', gridTemplateColumns: onBack ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {[['What to avoid', m.avoid], ["What they'd prefer", m.prefer]].map(([l, v], i) => <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', borderLeft: !onBack && i ? '1px solid var(--grid)' : 'none', borderTop: onBack && i ? '1px solid var(--grid)' : 'none' }}><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{l}</span><span style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.45 }}>{v || '—'}</span></div>)}
          </div>
        )}
        <section style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {m.draft ? <NovaMark title="Nova drafted a reply" /> : <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.kind === 'ticket' ? 'Reply in the portal' : 'Reply'}</span>}
          {editing || !m.draft ? <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Write a reply…" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }} />
            : <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{text}</p>}
          {msg ? <span style={{ fontSize: 13, color: msg.bad ? 'var(--danger)' : 'var(--success)' }}>{msg.t}</span> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {<button className="mm-btn mm-btn--primary" disabled={busy || !text.trim() || (msg && !msg.bad) === true} onClick={() => void send()}>{busy ? 'Sending…' : 'Send'}</button>}
            {m.draft && !editing && <button className="mm-btn" onClick={() => setEditing(true)}>Edit</button>}
            {m.draft && <button className="mm-btn" onClick={() => { void U.discard(m); setText(''); setEditing(true); }}>Discard</button>}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nothing sends until you tap Send.</span>
        </section>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {m.clientId && <button className="mm-btn" onClick={() => onOpenClient(m.clientId!)}>Open client</button>}
          {m.kind === 'ticket' && <><button className="mm-btn" onClick={() => void ticket('options_sent')}>Mark options sent</button><button className="mm-btn" onClick={() => void ticket('resolved')}>Mark resolved</button></>}
          {m.kind === 'mail' && <><button className="mm-btn" onClick={() => void mailStatus('replied')}>Mark replied</button><button className="mm-btn" onClick={() => void mailStatus('ignored')}>Ignore</button></>}
        </div>
      </div>
    </div>
  );
}
