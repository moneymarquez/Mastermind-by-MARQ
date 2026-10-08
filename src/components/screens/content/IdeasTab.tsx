import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api as callApi } from '../../../lib/api';
import type { useSocialAccounts, useContentItems } from '../../../data/useContentEngine';
import { latestMetrics } from '../../../data/contentEngine';
import { pullHelp } from '../../../data/contentOctober';
import { E, Badge, TeachingEmpty, btn, label } from '../ecom/ecomShared';
import Thumbs from '../../mm/Thumbs';

interface Idea { id: string; account_id: string | null; concept: string; hook: string; format: string; why: string | null; based_on_post_ids: string[]; status: string; created_at: string }
interface Brief { id: string; account_id: string | null; post_id: string | null; kind: string; brief: { what_worked?: string; do_next?: string } ; created_at: string }

/** Ideas (brief §3.1–3.2): ready-to-shoot ideas per account, never a blank
 *  page, plus the loop: winners become "do more like this" briefs, flops get
 *  a reason and an honest Pull. */
export default function IdeasTab({ accounts, items, onOpenPlan }: { accounts: ReturnType<typeof useSocialAccounts>; items: ReturnType<typeof useContentItems>; onOpenPlan: () => void }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [acct, setAcct] = useState<string>('all');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [missing, setMissing] = useState(false);
  const autoRan = useRef(false);
  const load = useCallback(async () => {
    const [i, b] = await Promise.all([
      supabase.from('social_ideas').select('id,account_id,concept,hook,format,why,based_on_post_ids,status,created_at').eq('status', 'new').order('created_at', { ascending: false }).limit(200),
      supabase.from('content_briefs').select('id,account_id,post_id,kind,brief,created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    setMissing(!!i.error);
    setIdeas((i.data ?? []) as Idea[]);
    setBriefs((b.data ?? []) as Brief[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const run = useCallback(async (accountId?: string) => {
    setBusy('Writing ideas… (20–40s)'); setMsg('');
    const r = await callApi<{ ok?: boolean; summary?: string; error?: string; skipped?: boolean }>('/api/content/ideas-run', { body: accountId ? { account_id: accountId } : {} });
    setBusy(''); setMsg(r.error ?? r.summary ?? ''); await load();
  }, [load]);
  // No blank page: an account with no ideas gets some on first open.
  useEffect(() => {
    if (autoRan.current || missing || accounts.loading || !accounts.accounts.length) return;
    const empty = accounts.accounts.find((a) => !ideas.some((i) => i.account_id === a.id));
    if (empty && ideas.length === 0) { autoRan.current = true; void run(empty.id); }
  }, [accounts.loading, accounts.accounts, ideas, missing, run]);

  const toPlan = async (id: string) => {
    setBusy('Adding…');
    const r = await callApi<{ item_id?: string; error?: string }>('/api/content/idea-plan', { body: { idea_id: id } });
    setBusy(''); setMsg(r.error ?? 'Added to the Plan as a scripted card.'); await load(); await items.reload();
  };
  const dismiss = async (id: string) => { setIdeas((x) => x.filter((i) => i.id !== id)); await supabase.from('social_ideas').update({ status: 'dismissed', updated_at: new Date().toISOString() }).eq('id', id); };
  const handle = (id: string | null) => accounts.accounts.find((a) => a.id === id)?.handle ?? '—';
  const shown = ideas.filter((i) => acct === 'all' || i.account_id === acct);
  const postHook = (id: string) => accounts.posts.find((p) => p.id === id)?.hook ?? null;

  const flops = useMemo(() => accounts.posts.filter((p) => p.grade === 1 && !p.pulled_at).slice(0, 12), [accounts.posts]);
  const markPulled = async (id: string) => { await supabase.from('social_posts').update({ pulled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id); await accounts.reload(); };

  if (missing) return <TeachingEmpty what="The Ideas tab needs the October content migration (schema_123) applied." connection="Supabase → run supabase/schema_123_content_october.sql" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Account" style={{ height: 36, borderRadius: 999, padding: '0 12px', background: 'var(--surface-2)', color: E.text, border: '1px solid var(--border)' }}>
          <option value="all">All accounts</option>
          {accounts.accounts.map((a) => <option key={a.id} value={a.id}>@{a.handle} · {a.platform}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btn('primary')} disabled={!!busy || !accounts.accounts.length} onClick={() => void run(acct === 'all' ? undefined : acct)}>{busy || 'More ideas'}</button>
      </div>
      {msg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{msg}</div>}
      {!accounts.accounts.length && <TeachingEmpty what="Add an account on the Accounts tab and ideas appear here automatically." worker="Idea & Script, nightly and on connect" />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {shown.map((i) => (
          <div key={i.id} style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge color={E.blue}>@{handle(i.account_id)}</Badge><Badge color={E.faint}>{i.format}</Badge></div>
            <div style={{ fontWeight: 700, color: E.text, fontSize: 15 }}>“{i.hook}”</div>
            <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{i.concept}</div>
            {i.why && <div style={{ fontSize: 'var(--text-caption)', color: E.text }}><span style={label}>Why it should work</span> {i.why}</div>}
            {i.based_on_post_ids.length > 0 && <div style={{ fontSize: 12, color: E.faint }}>Based on: {i.based_on_post_ids.map((id) => `“${(postHook(id) ?? 'a past post').slice(0, 40)}”`).join(', ')}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'auto' }}>
              <button style={btn('primary')} disabled={!!busy} onClick={() => void toPlan(i.id)}>Add to plan</button>
              <button style={btn('ghost')} onClick={() => void dismiss(i.id)}>Not this</button>
              <span style={{ marginLeft: 'auto' }}><Thumbs entityType="social_idea" entityId={i.id} domain="content" compact /></span>
            </div>
          </div>
        ))}
      </div>
      {shown.length > 0 && <button style={{ ...btn('ghost'), alignSelf: 'flex-start' }} onClick={onOpenPlan}>Open the Plan →</button>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div style={{ ...E.card, padding: 14 }}>
          <div style={{ fontWeight: 700, color: E.text, marginBottom: 6 }}>🚀 Do more like this</div>
          {briefs.length === 0 ? <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>When a post breaks out (3× the account's average) or you 👍 one, what worked lands here and feeds the next ideas.</div> : briefs.slice(0, 8).map((b) => (
            <div key={b.id} style={{ borderTop: `1px solid ${E.border}`, padding: '8px 0', fontSize: 'var(--text-caption)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Badge color={b.kind === 'liked' ? E.violet : E.green}>{b.kind === 'liked' ? '👍 liked' : 'breakout'}</Badge><span style={{ color: E.faint }}>@{handle(b.account_id)}</span></div>
              <div style={{ color: E.text, marginTop: 4 }}>{b.brief.what_worked}</div>
              {b.brief.do_next && <div style={{ color: E.muted }}>Next: {b.brief.do_next}</div>}
            </div>
          ))}
        </div>
        <div style={{ ...E.card, padding: 14 }}>
          <div style={{ fontWeight: 700, color: E.text, marginBottom: 6 }}>📉 Flops</div>
          {flops.length === 0 ? <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>No live flops. A post graded 1/4 shows here with why it probably missed.</div> : flops.map((p) => {
            const a = accounts.accounts.find((x) => x.id === p.account_id);
            const m = latestMetrics(accounts.metrics[p.id] ?? []);
            return (
              <div key={p.id} style={{ borderTop: `1px solid ${E.border}`, padding: '8px 0', fontSize: 'var(--text-caption)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><Badge color={E.amber}>flop</Badge><span style={{ color: E.text }}>“{(p.hook ?? p.caption ?? 'post').slice(0, 70)}”</span><span style={{ color: E.faint }}>@{a?.handle ?? '—'}{m?.views != null ? ` · ${m.views.toLocaleString('en-US')} views` : ''}</span></div>
                {p.flop_reason && <div style={{ color: E.muted }}>{p.flop_reason}</div>}
                <div style={{ color: E.faint }}>{pullHelp(a?.platform ?? '')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ ...btn('ghost'), textDecoration: 'none' }}>Open the post ↗</a>}
                  <button style={btn('ghost')} onClick={() => void markPulled(p.id)}>I pulled it</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
