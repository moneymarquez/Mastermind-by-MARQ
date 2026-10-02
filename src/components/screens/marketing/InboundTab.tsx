import { useEffect, useState } from 'react';
import { useInbound, inboundStats, SOURCE_LABEL, INBOUND_STATUSES } from '../../../data/useInbound';
import type { Inbound, InboundSource, InboundStatus } from '../../../data/useInbound';
import { runWorkerNow } from '../../../data/useEngine';
import { E, Badge, Metric, TeachingEmpty, btn, field, label, tint } from '../ecom/ecomShared';
import { askConfirm } from '../../../lib/confirm';

const SOURCE_COLOR: Record<InboundSource, string> = { website: E.blue, ig_dm: E.violet, tiktok: E.text, referral: E.green, google: E.amber, other: E.faint };
const fmtWait = (m: number) => (m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d`);

/** M3 — every lead that came to you: source, first touch, how long it
 *  waited for a reply, and where it ended up. The website form posts
 *  straight in; the Inbound Tracker tags sources the rules can't; anything
 *  unanswered after an hour raises an urgent alert. */
export default function InboundTab() {
  const api = useInbound();
  const [now, setNow] = useState(Date.now());
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const st = inboundStats(api.rows, 30, now);
  const rows = api.rows.filter((r) => filter === 'all' || !['client', 'lost'].includes(r.status));
  const track = async () => { setBusy(true); setMsg(''); const r = await runWorkerNow('inbound_tracker', {}); setBusy(false); setMsg(r.ok ? (r.skipped ? r.summary ?? '' : `${r.summary} Waiting in Approvals.`) : r.error ?? 'Run failed.'); };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        <Metric label="Inbound · 30d" value={String(st.total)} big />
        <Metric label="Waiting now" value={String(st.waiting)} />
        <Metric label="Median first reply" value={st.medianReplyMin == null ? '—' : fmtWait(st.medianReplyMin)} />
        <Metric label="Became clients" value={String(st.clients)} />
      </div>
      {st.total > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {(Object.keys(st.bySource) as InboundSource[]).sort((a, b) => st.bySource[b] - st.bySource[a]).map((s) => <Badge key={s} color={SOURCE_COLOR[s]}>{SOURCE_LABEL[s]} · {st.bySource[s]}</Badge>)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
        <button style={btn('primary')} onClick={() => setAdding((v) => !v)}>＋ Lead</button>
        <button style={btn('ghost')} disabled={busy} onClick={track}>{busy ? 'Tagging…' : '🏷️ Tag sources'}</button>
        <div style={{ flex: 1 }} />
        <select aria-label="Show" style={{ ...field, width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as 'open' | 'all')}><option value="open">Open</option><option value="all">All</option></select>
      </div>
      {msg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 6 }}>{msg}</div>}
      {api.error && <div style={{ fontSize: 'var(--text-caption)', color: E.red, marginTop: 6 }}>{api.error}</div>}
      {adding && <AddLead onAdd={async (x) => { if (await api.add(x)) setAdding(false); }} />}

      {!api.loading && api.rows.length === 0 && <div style={{ marginTop: 14 }}><TeachingEmpty what="No inbound leads yet. Put the form below on your website — every submission lands here with its source, and you get a push the moment it does." worker="the Inbound Tracker" /></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rows.map((r) => <LeadRow key={r.id} r={r} now={now} api={api} />)}
      </div>

      <FormSetup k={api.key} onMake={api.makeKey} />
    </div>
  );
}

function LeadRow({ r, now, api }: { r: Inbound; now: number; api: ReturnType<typeof useInbound> }) {
  const [open, setOpen] = useState(false);
  const wait = r.responded_at ? null : Math.floor((now - new Date(r.first_touch_at).getTime()) / 60000);
  const late = wait != null && wait >= 60 && r.status === 'new';
  const replied = r.responded_at ? Math.round((new Date(r.responded_at).getTime() - new Date(r.first_touch_at).getTime()) / 60000) : null;
  return (
    <div style={{ ...E.card, padding: 12, border: `1px solid ${late ? E.red : E.border}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge color={SOURCE_COLOR[r.source]}>{SOURCE_LABEL[r.source]}</Badge>
        <button onClick={() => setOpen((v) => !v)} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: E.text, flex: '1 1 140px', minWidth: 0, overflowWrap: 'anywhere' }}>{r.name || r.email || r.phone || 'Lead'}</button>
        {wait != null && r.status === 'new' ? <Badge color={late ? E.red : E.amber}>waiting {fmtWait(wait)}</Badge> : replied != null ? <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>replied in {fmtWait(replied)}</span> : null}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 'var(--text-body)' }}>
        {r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} style={{ color: E.blue }}>{r.phone}</a>}
        {r.email && <a href={`mailto:${r.email}`} style={{ color: E.blue, overflowWrap: 'anywhere' }}>{r.email}</a>}
        <span style={{ color: E.faint, fontSize: 'var(--text-caption)' }}>{new Date(r.first_touch_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
      </div>
      {r.message && <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 6, whiteSpace: 'pre-wrap' }}>{open ? r.message : r.message.slice(0, 160)}{!open && r.message.length > 160 ? '…' : ''}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        {!r.responded_at && <button style={{ ...btn('primary'), padding: '6px 12px' }} onClick={() => api.markReplied(r)}>✓ Replied</button>}
        <select aria-label="Status" style={{ ...field, width: 'auto', padding: '6px 10px' }} value={r.status} onChange={(e) => api.update(r.id, { status: e.target.value as InboundStatus, ...(r.responded_at || e.target.value === 'new' ? {} : { responded_at: new Date().toISOString() }) })}>
          {INBOUND_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button style={{ ...btn('ghost'), padding: '6px 10px', marginLeft: 'auto' }} onClick={() => setOpen((v) => !v)}>{open ? 'Less' : 'More'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Source</span> {r.source_detail ?? '—'}{r.source_by ? ` · tagged by ${r.source_by}` : ''}</div>
          {r.page_url && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, overflowWrap: 'anywhere' }}><span style={label}>Page</span> {r.page_url}</div>}
          <select aria-label="Source" style={{ ...field, width: 'auto' }} value={r.source} onChange={(e) => api.update(r.id, { source: e.target.value as InboundSource, source_by: 'you' })}>
            {(Object.keys(SOURCE_LABEL) as InboundSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
          <textarea style={{ ...field, minHeight: 56 }} defaultValue={r.notes ?? ''} placeholder="Notes" onBlur={(e) => { if (e.target.value !== (r.notes ?? '')) void api.update(r.id, { notes: e.target.value || null }); }} />
          <button style={{ ...btn('danger'), alignSelf: 'flex-start' }} onClick={async () => { if (await askConfirm('Delete this lead?')) await api.remove(r.id); }}>Delete</button>
        </div>
      )}
    </div>
  );
}

function AddLead({ onAdd }: { onAdd: (x: Partial<Inbound>) => void }) {
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [source, setSource] = useState<InboundSource>('ig_dm'), [notes, setNotes] = useState('');
  return (
    <div style={{ ...E.card, padding: 12, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={label}>A lead that came to you (DM, call, referral…)</div>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or business" autoFocus />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...field, flex: '1 1 140px' }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" />
        <input style={{ ...field, flex: '1 1 180px' }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" inputMode="email" />
      </div>
      <select aria-label="Source" style={field} value={source} onChange={(e) => setSource(e.target.value as InboundSource)}>{(Object.keys(SOURCE_LABEL) as InboundSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select>
      <textarea style={{ ...field, minHeight: 56 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What they said" />
      <button style={{ ...btn('primary'), alignSelf: 'flex-start' }} disabled={!name.trim() && !phone.trim() && !email.trim()} onClick={() => onAdd({ name: name.trim() || null, phone: phone.trim() || null, email: email.trim() || null, source, notes: notes.trim() || null, source_detail: 'Added by hand' })}>Save</button>
    </div>
  );
}

/** The form to paste on the website. The endpoint takes JSON or a plain
 *  form post; a plain form bounces back to its own page with ?sent=1. */
function FormSetup({ k, onMake }: { k: string | null; onMake: () => void }) {
  const [copied, setCopied] = useState('');
  const url = k ? `${window.location.origin}/api/inbound/${k}` : '';
  const snippet = `<form action="${url}" method="POST">
  <input name="name" placeholder="Name" required>
  <input name="email" type="email" placeholder="Email">
  <input name="phone" type="tel" placeholder="Phone">
  <textarea name="message" placeholder="What do you need?"></textarea>
  <input name="website_url" style="display:none" tabindex="-1" autocomplete="off">
  <button>Send</button>
</form>`;
  const copy = (what: string, text: string) => { void navigator.clipboard?.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500); };
  return (
    <div style={{ ...E.card, padding: 14, marginTop: 18 }}>
      <div style={{ ...label, marginBottom: 6 }}>Your website form</div>
      {!k ? (
        <>
          <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginBottom: 8 }}>Make a private address for your contact form. Anything posted to it lands here.</div>
          <button style={btn('primary')} onClick={onMake}>Make my form address</button>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: E.text, padding: 8, borderRadius: 6, background: E.sunk, overflowWrap: 'anywhere' }}>{url}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button style={btn('ghost')} onClick={() => copy('url', url)}>{copied === 'url' ? '✓ Copied' : 'Copy address'}</button>
            <button style={btn('ghost')} onClick={() => copy('html', snippet)}>{copied === 'html' ? '✓ Copied' : 'Copy HTML form'}</button>
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 'var(--text-caption)', color: E.blue, cursor: 'pointer' }}>How to use it</summary>
            <div style={{ fontSize: 'var(--text-caption)', color: E.muted, lineHeight: 1.5, marginTop: 4 }}>
              Paste the HTML form on your contact page, or point an existing form's action (Webflow, Framer, WordPress) at the address. It reads name, email, phone and message, plus UTM tags if your page passes them. The hidden <code>website_url</code> field catches bots. Keep the address private — anyone with it can post leads.
            </div>
            <pre style={{ fontSize: 11, color: E.text, background: tint(E.accent, 6), borderRadius: 6, padding: 8, overflow: 'auto', marginTop: 6 }}>{snippet}</pre>
          </details>
        </>
      )}
    </div>
  );
}
