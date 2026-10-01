import { useState } from 'react';
import type { useSocialAccounts, useContentItems, useInspiration } from '../../../data/useContentEngine';
import { PLATFORM } from '../../../data/contentEngine';
import type { Inspiration } from '../../../data/contentEngine';
import { runWorkerNow } from '../../../data/useEngine';
import { money } from '../../../data/ecom';
import { E, Badge, TeachingEmpty, btn, field, label, tint } from '../ecom/ecomShared';
import { askConfirm } from '../../../lib/confirm';

/** C3 — posts and trends to learn from. The Trend Researcher fills it (web
 *  search on public trend pages, never scraping IG or TikTok; you approve
 *  what it found), or you paste a link yourself. "Make our version" puts a
 *  post idea on the Plan in this account's voice. */
export default function InspirationTab({ api, accounts, items, onOpenPlan }: { api: ReturnType<typeof useInspiration>; accounts: ReturnType<typeof useSocialAccounts>; items: ReturnType<typeof useContentItems>; onOpenPlan: () => void }) {
  const [acct, setAcct] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [made, setMade] = useState<Set<string>>(new Set());
  const rows = api.rows.filter((r) => !acct || r.account_id === acct || r.account_id == null);

  const research = async () => {
    setBusy(true); setMsg(null);
    const r = await runWorkerNow('trend_researcher', acct ? { account_id: acct } : {});
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: r.skipped ? r.summary ?? 'Nothing new.' : `Found ${r.count ?? 'some'} — waiting in Approvals (top of this screen). ${money(r.costUsd ?? 0)}` } : { ok: false, text: r.error ?? 'Run failed.' });
  };
  const makeOurs = async (r: Inspiration) => {
    const created = await items.create({ concept: (r.our_version || r.title || 'New post').slice(0, 300), account_id: r.account_id ?? (acct || null), status: 'idea', hooks: r.hook ? [r.hook] : [], visual_prompt: r.format ? `Format: ${r.format}. Based on ${r.url}` : `Based on ${r.url}` });
    if (created) { setMade((m) => new Set(m).add(r.id)); setMsg({ ok: true, text: `"${created.concept.slice(0, 60)}" is in the Plan's backlog.` }); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select aria-label="Account" style={{ ...field, width: 'auto', maxWidth: '100%' }} value={acct} onChange={(e) => setAcct(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.accounts.map((a) => <option key={a.id} value={a.id}>{PLATFORM[a.platform].short} @{a.handle}</option>)}
        </select>
        <button style={btn('primary')} disabled={busy} onClick={research}>{busy ? 'Researching… (30–90s)' : '🔎 Find what’s working'}</button>
        <button style={btn('ghost')} onClick={() => setAdding((v) => !v)}>＋ Link</button>
      </div>
      {msg && <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-body)', color: E.text, background: tint(msg.ok ? E.green : E.red, 10), border: `1px solid ${tint(msg.ok ? E.green : E.red, 35)}` }}>
        {msg.text} {msg.ok && msg.text.includes('Plan') && <button style={{ ...btn('ghost'), padding: '2px 8px', fontSize: 12 }} onClick={onOpenPlan}>Open Plan</button>}
      </div>}
      {adding && <AddLink accountId={acct || null} onAdd={async (x) => { const ok = await api.add(x); if (ok) setAdding(false); }} />}
      {api.error && <div style={{ color: E.red, fontSize: 'var(--text-caption)', marginTop: 8 }}>{api.error}</div>}

      {!api.loading && rows.length === 0 && (
        <div style={{ marginTop: 14 }}>
          <TeachingEmpty what="Nothing saved yet. Tap “Find what’s working” — the Trend Researcher web-searches public trend pages for your accounts' niches and brings back posts to learn from, each with why it worked and “our version”." worker="the Trend Researcher (also runs Monday and Thursday nights)" />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 10, marginTop: 14 }}>
        {rows.map((r) => {
          const a = accounts.accounts.find((x) => x.id === r.account_id);
          return (
            <div key={r.id} style={{ ...E.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {r.format && <Badge color={E.violet}>{r.format}</Badge>}
                {r.platform && <Badge color={E.faint}>{r.platform}</Badge>}
                {a && <Badge color={E.blue}>@{a.handle}</Badge>}
                {r.source === 'manual' && <Badge color={E.faint}>saved by you</Badge>}
              </div>
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: E.text, textDecoration: 'none', overflowWrap: 'anywhere' }}>{r.title || r.url} <span style={{ color: E.blue, fontWeight: 400 }}>↗</span></a>
              {r.hook && <div style={{ fontSize: 'var(--text-body)', color: E.text }}>“{r.hook}”</div>}
              {r.why_it_worked && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, lineHeight: 1.45 }}><span style={label}>Why it worked</span> {r.why_it_worked}</div>}
              {r.principle && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Principle</span> {r.principle}</div>}
              {r.our_version && <div style={{ fontSize: 'var(--text-caption)', color: E.text, padding: 8, borderRadius: 6, background: tint(E.accent, 8), lineHeight: 1.45 }}><span style={label}>Our version</span> {r.our_version}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                <button style={{ ...btn(made.has(r.id) ? 'ghost' : 'primary'), padding: '6px 12px', fontSize: 13 }} disabled={made.has(r.id)} onClick={() => makeOurs(r)}>{made.has(r.id) ? '✓ On the Plan' : 'Make our version'}</button>
                <button aria-label="Remove" style={{ ...btn('ghost'), padding: '6px 10px', fontSize: 13, marginLeft: 'auto' }} onClick={async () => { if (await askConfirm('Remove this from Inspiration?')) await api.remove(r.id); }}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddLink({ accountId, onAdd }: { accountId: string | null; onAdd: (x: Partial<Inspiration> & { url: string }) => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [ours, setOurs] = useState('');
  const ok = /^https?:\/\/\S+\.\S+/.test(url.trim());
  return (
    <div style={{ ...E.card, padding: 12, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={label}>Save a post to learn from</div>
      <input style={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" autoFocus />
      <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it? (e.g. “Plumber does before/after in 7s”)" />
      <textarea style={{ ...field, minHeight: 56 }} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why it worked — hook, format, pacing" />
      <textarea style={{ ...field, minHeight: 56 }} value={ours} onChange={(e) => setOurs(e.target.value)} placeholder="Our version (optional)" />
      <button style={{ ...btn('primary'), alignSelf: 'flex-start' }} disabled={!ok} onClick={() => onAdd({ url: url.trim(), title: title.trim() || null, why_it_worked: why.trim() || null, our_version: ours.trim() || null, account_id: accountId, tags: [] })}>Save</button>
    </div>
  );
}
