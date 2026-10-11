import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PLATFORM, compact } from '../../../data/contentEngine';
import type { useSocialAccounts } from '../../../data/useContentEngine';
import { buildHistory, filterHistory, historyCsv } from '../../../data/postHistory';
import type { HistoryKind, PublishAttempt } from '../../../data/postHistory';
import { E, Badge, Pill, btn, field } from '../ecom/ecomShared';

const KIND: Record<HistoryKind, { label: string; color: string }> = { posted: { label: 'Posted', color: E.green }, test: { label: 'Test (not posted)', color: E.faint }, failed: { label: 'Failed', color: E.red } };

/** Everything that went out, across every account, newest first. */
export default function HistoryTab({ accounts }: { accounts: ReturnType<typeof useSocialAccounts> }) {
  const [attempts, setAttempts] = useState<PublishAttempt[]>([]);
  const [f, setF] = useState<{ account: string; kind: 'all' | HistoryKind; q: string }>({ account: 'all', kind: 'all', q: '' });
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    supabase.from('content_publish_log').select('id,account_id,platform,status,url,error,created_at,content_item_id').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setAttempts((data ?? []) as PublishAttempt[]), () => setAttempts([]));
  }, [accounts.posts.length]);
  const all = useMemo(() => buildHistory(accounts.accounts, accounts.posts, accounts.metrics, attempts), [accounts.accounts, accounts.posts, accounts.metrics, attempts]);
  const rows = useMemo(() => filterHistory(all, f), [all, f]);
  const count = (k: HistoryKind) => all.filter((r) => r.kind === k).length;
  const exportCsv = () => { const url = URL.createObjectURL(new Blob([historyCsv(rows)], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `post-history-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url); };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select aria-label="Account" style={{ ...field, width: 'auto' }} value={f.account} onChange={(e) => { setF({ ...f, account: e.target.value }); setLimit(30); }}>
          <option value="all">All accounts</option>
          {accounts.accounts.map((a) => <option key={a.id} value={a.id}>{PLATFORM[a.platform].short} @{a.handle}</option>)}
        </select>
        <Pill active={f.kind === 'all'} onClick={() => setF({ ...f, kind: 'all' })}>All {all.length}</Pill>
        {(['posted', 'test', 'failed'] as const).map((k) => <Pill key={k} active={f.kind === k} onClick={() => setF({ ...f, kind: k })}>{KIND[k].label} {count(k)}</Pill>)}
        <input aria-label="Search" style={{ ...field, flex: '1 1 160px', minWidth: 0 }} placeholder="Search captions" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <button style={btn('ghost')} onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
      </div>
      {all.length === 0 && <div style={{ ...E.card, padding: 16, marginTop: 14, fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.5 }}>Nothing yet. Connect an account and press <strong>Sync real numbers</strong> on Accounts to pull in what's already posted, or post from Studio.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {rows.slice(0, limit).map((r) => (
          <div key={r.id} style={{ ...E.card, padding: 12, display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 12, borderColor: r.kind === 'failed' ? E.red : undefined }}>
            {r.thumb ? <img src={r.thumb} alt="" loading="lazy" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${E.border}` }} /> : <div style={{ width: 64, height: 80, borderRadius: 8, background: 'var(--surface-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: E.faint }}>{PLATFORM[r.platform as 'instagram']?.short ?? ''}</div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: E.text }}>@{r.handle}</strong>
                <Badge color={KIND[r.kind].color}>{KIND[r.kind].label}</Badge>
                {r.source === 'imported' && <Badge color={E.faint}>Imported</Badge>}
                <span style={{ fontSize: 'var(--text-caption)', color: E.faint, marginLeft: 'auto' }}>{new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              {r.caption && <div style={{ fontSize: 14, color: E.text, marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>{r.caption}</div>}
              {r.error && <div style={{ fontSize: 13, color: E.red, marginTop: 4, overflowWrap: 'anywhere' }}>{r.error}</div>}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: E.muted }}>
                {r.kind !== 'failed' && <><span title="views">👁 {compact(r.views)}</span><span title="likes">♥ {compact(r.likes)}</span><span title="comments">💬 {compact(r.comments)}</span><span title="saves">🔖 {compact(r.saves)}</span></>}
                {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: E.blue }}>Open ↗</a>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {rows.length > limit && <div style={{ marginTop: 12 }}><button style={btn('ghost')} onClick={() => setLimit((l) => l + 30)}>Show 30 more ({rows.length - limit} left)</button></div>}
      {all.length > 0 && rows.length === 0 && <div style={{ fontSize: 'var(--text-body)', color: E.faint, marginTop: 14 }}>Nothing matches those filters.</div>}
    </div>
  );
}
