import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import '../../shell/shell.css';
import type { Device } from '../../shell/Shell';
import type { useOwnerInbox } from '../../../data/useOwnerInbox';
import type { useLeadFeed, FeedLead } from '../../../data/useLeadFeed';
import { waitingMin, temperature, fmtAgo, fmtWait, URGENT_WAIT_MIN } from '../../../data/useLeadFeed';
import { useUnifiedInbox } from '../../../data/useUnifiedInbox';
import type { UMsg } from '../../../data/useUnifiedInbox';
import { supabase } from '../../../lib/supabase';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Stat from '../../mm/Stat';
import Card from '../../mm/Card';
import { Bars, Donut } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { GChevronLeft, GNova, GCheck } from '../../shell/glyphs';

/** Inbox + Leads (design handoff: MM Inbox, MM Leads). One feed from every
 *  address and the client portal, and every inbound lead. Phone: Inbox |
 *  Leads tabs, list → full-screen detail. iPad/desktop: a split view.
 *  Nothing sends until Send is tapped. */
interface Props {
  device: Device; isOwner: boolean; initialTab?: 'inbox' | 'leads';
  inbox: ReturnType<typeof useOwnerInbox>; feed: ReturnType<typeof useLeadFeed>;
  focus: { tab: 'inbox' | 'leads'; ref?: string } | null; onFocusConsumed: () => void;
  onOpenClient: (clientId: string) => void; onOpenLeadFlow: () => void; onNavigate: (s: string) => void;
}

const h1: CSSProperties = { margin: 0, color: 'var(--text)', fontWeight: 700, letterSpacing: '-0.035em' };
const initials = (s: string) => s.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '··';
const timeOf = (iso: string, now: number) => {
  const d = new Date(iso), days = Math.floor((now - d.getTime()) / 86400000);
  if (days < 1 && new Date(now).toDateString() === d.toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days < 2) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const SORT_KIND: Record<string, ChipKind> = { Lead: 'accent', Client: 'client' };

export default function InboxScreen(p: Props) {
  const phone = p.device === 'phone';
  const [tab, setTab] = useState<'inbox' | 'leads'>(p.focus?.tab ?? p.initialTab ?? 'inbox');
  const ui = useUnifiedInbox(p.isOwner);
  useEffect(() => { if (p.focus) { setTab(p.focus.tab); } }, [p.focus]);
  useEffect(() => { if (p.initialTab) setTab(p.initialTab); }, [p.initialTab]);
  const waiting = p.feed.waiting;
  const unread = ui.msgs.filter((m) => m.unread).length;

  if (!p.isOwner) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h1 style={{ ...h1, fontSize: phone ? 24 : 28 }}>Inbox</h1><Empty text="Connect an inbox to see your mail here. Client portal questions and tickets flow in on their own." /></div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 16 : 20 }}>
      <div>
        <h1 style={{ ...h1, fontSize: phone ? 24 : 28 }}>{tab === 'leads' && !phone ? 'Leads' : 'Inbox'}</h1>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{tab === 'leads' ? 'Every lead that came to you, from every door' : 'Every connected address + the client portal'}</div>
      </div>
      {phone && (
        <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {(['inbox', 'leads'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ height: 40, borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: tab === t ? 'var(--text)' : 'transparent', color: tab === t ? 'var(--bg)' : 'var(--text-secondary)' }}>
              {t === 'inbox' ? 'Inbox' : 'Leads'}
              {(t === 'inbox' ? unread : waiting) > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: t === 'leads' && p.feed.urgent ? 'var(--danger)' : 'var(--accent)', color: 'var(--bg)' }}>{t === 'inbox' ? unread : waiting}</span>}
            </button>
          ))}
        </div>
      )}
      {tab === 'inbox'
        ? <InboxView {...p} ui={ui} />
        : <LeadsView {...p} />}
    </div>
  );
}

// ── Inbox ─────────────────────────────────────────────────────────────
type Filter = { key: string; label: string; test: (m: UMsg) => boolean };
function InboxView({ device, focus, onFocusConsumed, onOpenClient, ui }: Props & { ui: ReturnType<typeof useUnifiedInbox> }) {
  const phone = device === 'phone';
  const now = Date.now();
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const sources = useMemo(() => [...new Set(ui.msgs.map((m) => m.source))], [ui.msgs]);
  const filters: Filter[] = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'unread', label: 'Unread', test: (m) => m.unread },
    { key: 'leads', label: 'Leads', test: (m) => m.sort === 'Lead' },
    { key: 'clients', label: 'Clients', test: (m) => m.sort === 'Client' },
    { key: 'support', label: 'Support', test: (m) => m.sort === 'Support' },
    ...sources.map((s) => ({ key: `src:${s}`, label: s, test: (m: UMsg) => m.source === s })),
  ];
  const f = filters.find((x) => x.key === filter) ?? filters[0];
  const list = ui.msgs.filter(f.test);
  const open = ui.msgs.find((m) => m.id === openId) ?? null;

  // A notification tap lands on that message open.
  useEffect(() => {
    if (focus?.tab === 'inbox' && focus.ref) {
      const m = ui.msgs.find((x) => x.id === focus.ref);
      if (m) { setOpenId(m.id); void ui.markRead(m); onFocusConsumed(); }
    }
  }, [focus, ui.msgs]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wide: the first message is open by default.
  useEffect(() => { if (!phone && !openId && list[0]) setOpenId(list[0].id); }, [phone, list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const openMsg = (m: UMsg) => { setOpenId(m.id); void ui.markRead(m); };

  if (!ui.loading && ui.msgs.length === 0) {
    return <Empty text="No mail yet. Messages sent to your connected addresses, plus client portal questions and tickets, land here." />;
  }
  const chips = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {filters.map((x) => {
        const n = ui.msgs.filter(x.test).length;
        if (x.key !== 'all' && n === 0) return null;
        const on = x.key === f.key;
        return <button key={x.key} onClick={() => setFilter(x.key)} style={{ height: 30, padding: '0 11px', borderRadius: 999, border: `1px solid ${on ? 'var(--text)' : 'var(--border)'}`, background: on ? 'var(--text)' : 'transparent', color: on ? 'var(--bg)' : 'var(--text-secondary)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{x.label}{x.key !== 'all' && <span style={{ opacity: 0.7 }}>{n}</span>}</button>;
      })}
    </div>
  );
  const rows = (
    <div role="list">
      {list.map((m) => <MsgRow key={m.id} m={m} now={now} active={!phone && m.id === openId} onOpen={() => openMsg(m)} />)}
      {list.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}><GCheck size={18} color="var(--success)" style={{ margin: '0 auto 6px' }} />You're caught up.</div>}
    </div>
  );

  if (phone) {
    if (open) return <MsgDetail m={open} phone onBack={() => setOpenId(null)} ui={ui} onOpenClient={onOpenClient} />;
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{chips}<div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{rows}</div></div>;
  }
  const listW = device === 'desktop' ? 400 : 340;
  return (
    <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', height: device === 'desktop' ? 720 : 640, maxHeight: 'calc(100vh - 200px)', minHeight: 440 }}>
      <div style={{ width: listW, flex: 'none', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--grid)' }}>{chips}</div>
        <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>{rows}</div>
      </div>
      <div className="mm-scroll-y" style={{ flex: 1, minWidth: 0, padding: '22px 24px' }}>
        {open ? <MsgDetail m={open} ui={ui} onOpenClient={onOpenClient} /> : <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Pick a message.</div>}
      </div>
    </div>
  );
}

function SourceTag({ m }: { m: UMsg }) {
  return <span style={{ fontSize: 11.5, fontWeight: 500, padding: '1px 6px', borderRadius: 4, border: `1px solid ${m.portal ? 'var(--client-accent)' : 'var(--border)'}`, color: m.portal ? 'var(--client-accent)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.sourceLabel}</span>;
}
function MsgRow({ m, now, active, onOpen }: { m: UMsg; now: number; active: boolean; onOpen: () => void }) {
  return (
    <button role="listitem" onClick={onOpen} style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', padding: '12px 14px', border: 0, borderBottom: '1px solid var(--grid)', background: active ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 7, flex: 'none', background: m.unread ? 'var(--accent)' : 'transparent' }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', gap: 8 }}><span style={{ flex: 1, color: 'var(--text)', fontSize: 14.5, fontWeight: m.unread ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.sender}</span><span style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 'none' }}>{timeOf(m.at, now)}</span></span>
        <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: m.unread ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body.replace(/\s+/g, ' ').slice(0, 140)}</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 3 }}>
          <SourceTag m={m} />
          {m.sort && <Chip k={SORT_KIND[m.sort] ?? 'neutral'}>{m.sort}</Chip>}
          {m.draft && !m.replied && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><GNova size={10} fill color="var(--accent)" />Draft ready</span>}
          {m.replied && <Chip k="good">Replied</Chip>}
        </span>
      </span>
    </button>
  );
}

function MsgDetail({ m, phone, onBack, ui, onOpenClient }: { m: UMsg; phone?: boolean; onBack?: () => void; ui: ReturnType<typeof useUnifiedInbox>; onOpenClient: (id: string) => void }) {
  const [draft, setDraft] = useState(m.draft ?? '');
  const [editing, setEditing] = useState(false);
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setDraft(m.draft ?? ''); setEditing(false); setComposer(''); setSentAt(null); setErr(''); }, [m.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true); setErr('');
    const r = await ui.send(m, text);
    setBusy(false);
    if (r.ok) setSentAt(Date.now()); else setErr(r.error ?? 'Could not send.');
  };
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {phone && <button onClick={onBack} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 10px 0 4px', border: 0, background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginLeft: -6 }}><GChevronLeft size={18} />Inbox</button>}
      <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.25 }}>{m.subject}</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><SourceTag m={m} />{m.sort && <Chip k={SORT_KIND[m.sort] ?? 'neutral'}>Sorted: {m.sort}</Chip>}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid var(--grid)', borderBottom: '1px solid var(--grid)' }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--text)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(m.sender)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text)', fontSize: 14.5, fontWeight: 600 }}>{m.sender}{m.org && <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}> · {m.org}</span>}</div>
          {m.fromAddr && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fromAddr} → {m.toAddr}</div>}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', flex: 'none' }}>{new Date(m.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
      </div>
      <div style={{ color: 'var(--text)', fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
      {m.kind === 'ticket' && (
        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 10 }}>
          <Field label="What to avoid" value={m.avoid} />
          <Field label="What they'd prefer" value={m.prefer} />
        </div>
      )}
      {m.clientId && <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onOpenClient(m.clientId!)}>Open client</button>}

      {sentAt || m.replied ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}><Chip k="good">Sent</Chip><span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{sentAt ? 'Sent just now.' : 'You replied to this.'}</span></div>
      ) : m.draft ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GNova size={13} fill color="var(--accent)" /><span style={{ flex: 1, color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>Nova drafted a reply</span>{m.toAddr && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>From {m.toAddr}</span>}</div>
          {editing
            ? <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }} />
            : <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{draft}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="mm-btn mm-btn--primary" style={{ height: phone ? 46 : 38 }} disabled={busy} onClick={() => send(draft)}>{busy ? 'Sending…' : 'Send'}</button>
            <button className="mm-btn" style={{ height: phone ? 46 : 38 }} onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</button>
            <button className="mm-btn" style={{ height: phone ? 46 : 38, color: 'var(--text-secondary)' }} onClick={() => ui.discard(m)}>Discard</button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nothing sends until you tap Send.</span>
          {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No reply drafted.</span>
          <textarea value={composer} onChange={(e) => setComposer(e.target.value)} rows={4} placeholder={m.portal ? 'Reply in their portal' : 'Write a reply'} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }} />
          <button className="mm-btn mm-btn--primary" style={{ alignSelf: 'flex-start', height: phone ? 46 : 38 }} disabled={busy || !composer.trim()} onClick={() => send(composer)}>{busy ? 'Sending…' : 'Send'}</button>
          {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
        </div>
      )}
    </article>
  );
}
function Field({ label, value }: { label: string; value: string | null }) {
  return <div style={{ padding: 12, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div><div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.45 }}>{value || '—'}</div></div>;
}

// ── Leads ─────────────────────────────────────────────────────────────
const TEMP: Record<string, { k: ChipKind; label: string }> = { hot: { k: 'hot', label: 'Hot' }, warm: { k: 'warm', label: 'Warm' }, cold: { k: 'cold', label: 'Cold' } };
const LS_DISMISS = 'mm-leads-dismissed', LS_CRM = 'mm-leads-in-crm';
const lsSet = (k: string) => { try { return new Set(JSON.parse(localStorage.getItem(k) ?? '[]') as string[]); } catch { return new Set<string>(); } };
const lsSave = (k: string, s: Set<string>) => { try { localStorage.setItem(k, JSON.stringify([...s].slice(-500))); } catch { /* private mode */ } };

function LeadsView({ device, feed, onOpenLeadFlow, onNavigate, onOpenClient }: Props) {
  const phone = device === 'phone', desktop = device === 'desktop';
  const now = feed.now;
  const [filter, setFilter] = useState<'all' | 'hot' | 'waiting'>('all');
  const [dismissed, setDismissed] = useState(() => lsSet(LS_DISMISS));
  const [inCrm, setInCrm] = useState(() => lsSet(LS_CRM));
  const live = feed.leads.filter((l) => !dismissed.has(l.id) && l.status !== 'lost' && l.status !== 'dismissed');
  const shown = live.filter((l) => filter === 'all' || (filter === 'hot' ? temperature(l, now) === 'hot' : waitingMin(l, now) != null));
  const today = new Date(now).toDateString();
  const newToday = live.filter((l) => new Date(l.at).toDateString() === today).length;
  const week = live.filter((l) => now - new Date(l.at).getTime() < 7 * 86400000);
  const repliedFast = week.filter((l) => l.repliedAt && new Date(l.repliedAt).getTime() - new Date(l.at).getTime() <= 3600000).length;
  const answerable = week.filter((l) => l.kind === 'inbound');
  const overHour = live.filter((l) => (waitingMin(l, now) ?? 0) >= URGENT_WAIT_MIN).length;

  const dismiss = async (l: FeedLead) => {
    const n = new Set(dismissed); n.add(l.id); setDismissed(n); lsSave(LS_DISMISS, n);
    if (l.kind === 'inbound') await supabase.from('mkt_inbound').update({ status: 'lost', updated_at: new Date().toISOString() }).eq('id', l.rawId);
    if (l.kind === 'mail') await supabase.from('support_inbox').update({ status: 'ignored' }).eq('id', l.rawId);
  };
  const addToCrm = async (l: FeedLead) => {
    if (l.kind === 'audit') { onOpenClient(l.rawId); return; }
    const { data, error } = await supabase.from('crm_clients').insert({ business_name: (l.business || l.name).slice(0, 160), contact_name: l.name, contact_email: l.email, contact_phone: l.phone }).select('id').single();
    if (error) return;
    if (l.kind === 'inbound') await supabase.from('mkt_inbound').update({ contact_id: (data as { id: string }).id }).eq('id', l.rawId);
    const n = new Set(inCrm); n.add(l.id); setInCrm(n); lsSave(LS_CRM, n);
  };
  const markReplied = async (l: FeedLead) => {
    if (l.kind === 'inbound') { await supabase.from('mkt_inbound').update({ responded_at: new Date().toISOString(), status: 'replied' }).eq('id', l.rawId); void feed.reload(); }
  };
  const actions = { dismiss, addToCrm, markReplied, onNavigate, inCrm };

  // "Where leads came from" + "Time to first reply" from the real feed.
  const bySource = Object.entries(live.reduce<Record<string, number>>((a, l) => { a[l.source] = (a[l.source] ?? 0) + 1; return a; }, {})).map(([name, value]) => ({ name, value }));
  const weeks = [3, 2, 1, 0].map((w) => {
    const end = now - w * 7 * 86400000, start = end - 7 * 86400000;
    const r = feed.leads.filter((l) => l.repliedAt && new Date(l.at).getTime() >= start && new Date(l.at).getTime() < end).map((l) => (new Date(l.repliedAt!).getTime() - new Date(l.at).getTime()) / 60000).sort((a, b) => a - b);
    return { label: w === 0 ? 'This wk' : `${w} wk ago`, v: r.length ? Math.round(r[Math.floor((r.length - 1) / 2)]) : 0 };
  });

  if (!feed.loading && feed.leads.length === 0) {
    return <Empty text="No leads yet. Website form submissions, audit forms, DMs you log and lead emails all show up here." cta="Open in LeadFlow" onCta={onOpenLeadFlow} />;
  }
  const filterBar = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {([['all', `All ${live.length}`], ['hot', `Hot ${live.filter((l) => temperature(l, now) === 'hot').length}`], ['waiting', `Waiting ${feed.waiting}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: filter === k ? 'var(--text)' : 'transparent', color: filter === k ? 'var(--bg)' : 'var(--text-secondary)' }}>{label}</button>
        ))}
      </div>
      <button className="mm-btn" style={{ height: 34 }} onClick={onOpenLeadFlow}>Open in LeadFlow ↗</button>
    </div>
  );
  const stats = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: phone ? 8 : 16 }}>
      <Stat label="New today" value={newToday} />
      <Stat label="Waiting on me" value={feed.waiting} pill={overHour ? `${overHour} over an hour` : undefined} k="bad" />
      <Stat label="Replied within 1 hour" value={answerable.length ? `${Math.round((repliedFast / answerable.length) * 100)}%` : '—'} pill={answerable.length ? `${repliedFast} of ${answerable.length} this week` : 'No replies logged yet'} k="neutral" />
    </div>
  );
  const charts = (
    <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignContent: 'start' }}>
      <Card title="Where leads came from" meta="Last 60 days"><Donut rows={bySource} pre="" center="Leads" /></Card>
      <Card title="Time to first reply" meta="Median, minutes"><Bars vals={weeks.map((w) => w.v)} labels={weeks.map((w) => w.label)} pre="" suf="m" h={100} /></Card>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 16 : 20 }}>
      {stats}
      {filterBar}
      {phone ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '4px 14px' }}>
          {shown.map((l, i) => <LeadCard key={l.id} l={l} now={now} first={i === 0} {...actions} />)}
          {shown.length === 0 && <div style={{ padding: 20, color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center' }}>Nothing here.</div>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'minmax(0, 1fr) 340px' : '1fr', gap: 16, alignItems: 'start' }}>
          <LeadsTable leads={shown} now={now} {...actions} />
          {charts}
        </div>
      )}
      {phone && charts}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Hot = arrived in the last 2 hours and still waiting · Warm = this week · Cold = older. Not AI-scored.</div>
    </div>
  );
}

type LeadActs = { dismiss: (l: FeedLead) => void; addToCrm: (l: FeedLead) => void; markReplied: (l: FeedLead) => void; onNavigate: (s: string) => void; inCrm: Set<string> };
function leadChips(l: FeedLead, now: number) {
  const t = TEMP[temperature(l, now)], w = waitingMin(l, now);
  return <><Chip k={t.k}>{t.label}</Chip>{w != null && <Chip k={w >= URGENT_WAIT_MIN ? 'bad' : 'warn'}>Waiting {fmtWait(w)}</Chip>}</>;
}
function LeadButtons({ l, dismiss, addToCrm, markReplied, onNavigate, inCrm, compact }: LeadActs & { l: FeedLead; compact?: boolean }) {
  const h = compact ? 30 : 40;
  const crm = l.inCrm || inCrm.has(l.id);
  const sz: CSSProperties = compact ? { fontSize: 13, padding: '0 10px', fontWeight: 500 } : {};
  const reply = l.email ? `mailto:${l.email}` : null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: compact ? 'nowrap' : 'wrap', justifyContent: compact ? 'flex-end' : undefined }}>
      {l.phone ? <a className="mm-btn mm-btn--primary" style={{ height: h, textDecoration: 'none', ...sz }} href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} onClick={() => markReplied(l)}>Call</a> : <span className="mm-btn mm-btn--primary" style={{ height: h, opacity: 0.4, cursor: 'default', ...sz }} title="No phone number">Call</span>}
      {l.kind === 'mail' ? <button className="mm-btn" style={{ height: h, ...sz }} onClick={() => onNavigate('inbox')}>Reply</button> : reply ? <a className="mm-btn" style={{ height: h, textDecoration: 'none', ...sz }} href={reply} onClick={() => markReplied(l)}>Reply</a> : null}
      <button className="mm-btn" style={{ height: h, color: crm ? 'var(--success)' : undefined, ...sz }} disabled={crm && l.kind !== 'audit'} onClick={() => addToCrm(l)}>{crm ? (l.kind === 'audit' ? 'In CRM ✓ Open' : 'In CRM ✓') : 'Add to CRM'}</button>
      <button className="mm-btn" style={{ height: h, color: 'var(--text-secondary)', ...sz }} onClick={() => dismiss(l)}>Dismiss</button>
    </div>
  );
}
function LeadCard({ l, now, first, ...acts }: LeadActs & { l: FeedLead; now: number; first: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0', borderTop: first ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--text)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(l.name)}</span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8 }}><span style={{ flex: 1, color: 'var(--text)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtAgo(l.at, now)}</span></div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{[l.business, l.source].filter(Boolean).join(' · ')}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{leadChips(l, now)}</div>
        </div>
      </div>
      <LeadButtons l={l} {...acts} />
    </div>
  );
}
function LeadsTable({ leads, now, ...acts }: LeadActs & { leads: FeedLead[]; now: number }) {
  const th: CSSProperties = { textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' };
  const td: CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--grid)', verticalAlign: 'middle' };
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Lead</th><th style={th}>Source</th><th style={th}>Temperature</th><th style={{ ...th, textAlign: 'right' }}>Quick actions</th></tr></thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id}>
              <td style={td}><div style={{ color: 'var(--text)', fontSize: 14.5, fontWeight: 600 }}>{l.name}</div>{l.business && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{l.business}</div>}</td>
              <td style={td}><div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{l.source}</div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtAgo(l.at, now)}</div></td>
              <td style={td}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{leadChips(l, now)}</div></td>
              <td style={{ ...td, textAlign: 'right' }}><div style={{ display: 'inline-flex' }}><LeadButtons l={l} compact {...acts} /></div></td>
            </tr>
          ))}
          {leads.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--text-tertiary)' }}>Nothing here.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
