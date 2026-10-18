import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Page, Sheet, Field, field, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { REACTIONS, winCard, canPost, FEED_DAILY_LIMIT } from '../../../data/feed';
import type { WinInput, WinKind } from '../../../data/feed';
import { findWins } from '../../../data/wins';

interface Post { id: string; user_id: string; author_name: string | null; kind: WinKind; title: string; line: string | null; photo_path: string | null; data: Record<string, unknown>; show_numbers: boolean; hidden: boolean; created_at: string }
interface Reaction { post_id: string; user_id: string; emoji: string }
const PAGE = 20;
const photoUrl = (p: string) => supabase.storage.from('feed-photos').getPublicUrl(p).data.publicUrl;

/** Feed v1 (brief §4.10): wins from people who opted in, newest first,
 *  reactions only. Private by default; numbers hidden unless you show them. */
export default function FeedScreen() {
  const { isOwner } = useModule();
  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [rx, setRx] = useState<Reaction[]>([]);
  const [done, setDone] = useState(false);
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [wins, setWins] = useState<WinInput[]>([]);
  const [compose, setCompose] = useState<WinInput | null>(null);
  const [missing, setMissing] = useState(false);
  const [mod, setMod] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(async (before?: string) => {
    let q = supabase.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(PAGE);
    if (!mod) q = q.eq('hidden', false);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) { setMissing(true); return; }
    const rows = (data ?? []) as Post[];
    setPosts((p) => (before ? [...p, ...rows] : rows));
    setDone(rows.length < PAGE);
    if (rows.length) { const r = await supabase.from('feed_reactions').select('post_id,user_id,emoji').in('post_id', rows.map((x) => x.id)); setRx((x) => [...(before ? x : []), ...((r.data ?? []) as Reaction[])]); }
  }, [mod]);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    void supabase.from('user_setup').select('feed_opt_in').maybeSingle().then(({ data }) => setOptIn(!!(data as { feed_opt_in?: boolean } | null)?.feed_opt_in));
    void loadPage();
    void findWins().then(setWins);
  }, [loadPage]);
  useEffect(() => {
    const el = sentinel.current; if (!el || done) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && posts.length) void loadPage(posts[posts.length - 1].created_at); });
    io.observe(el); return () => io.disconnect();
  }, [posts, done, loadPage]);

  const react = async (p: Post, emoji: string) => {
    if (!me) return;
    const mine = rx.some((r) => r.post_id === p.id && r.user_id === me && r.emoji === emoji);
    setRx((x) => (mine ? x.filter((r) => !(r.post_id === p.id && r.user_id === me && r.emoji === emoji)) : [...x, { post_id: p.id, user_id: me, emoji }]));
    if (mine) await supabase.from('feed_reactions').delete().eq('post_id', p.id).eq('user_id', me).eq('emoji', emoji);
    else await supabase.from('feed_reactions').insert({ post_id: p.id, emoji });
  };
  const report = async (p: Post) => { const reason = window.prompt('What\'s wrong with this post?') ?? ''; if (!reason.trim()) return; await supabase.from('feed_reports').insert({ post_id: p.id, reason: reason.slice(0, 500) }); window.alert('Reported. Thanks — the owner will look at it.'); };
  const hide = async (p: Post, hidden: boolean) => { await supabase.from('feed_posts').update({ hidden }).eq('id', p.id); setPosts((x) => x.map((y) => (y.id === p.id ? { ...y, hidden } : y))); };
  const suspend = async (p: Post) => { if (!window.confirm('Stop this person posting to the Feed?')) return; await supabase.from('feed_suspensions').upsert({ user_id: p.user_id, reason: 'owner moderation' }); };
  const setOpt = async (on: boolean) => { setOptIn(on); await supabase.from('user_setup').upsert({ feed_opt_in: on, updated_at: new Date().toISOString() }); };

  if (missing) return <Page title="Feed"><Empty text="The Feed needs the October migration (schema_124) applied." /></Page>;
  return (
    <Page title="Feed" sub="Wins from people building with Masterminds. Reactions only." fab={optIn ? { t: 'Post', onClick: () => setCompose({ kind: 'manual' }) } : undefined} menu={isOwner ? [{ t: mod ? 'Leave moderation' : 'Moderation queue', onClick: () => setMod((x) => !x) }] : []}>
      {optIn === false && (
        <Card title="Join the Feed?">
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nothing you do is shared unless you post it. Each post is your choice, and weight, body stats, money and peptides stay hidden unless you turn them on for that post.</div>
          <button className="mm-btn mm-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => void setOpt(true)}>Turn on sharing</button>
        </Card>
      )}
      {optIn && wins.length > 0 && (
        <Card title="Share this win" meta="from your own data">
          {wins.map((w, i) => { const c = winCard(w, false); return <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}><span style={{ flex: 1, fontSize: 14 }}>{c.title}</span><button className="mm-btn" style={{ height: 32 }} onClick={() => setCompose(w)}>Share</button></div>; })}
        </Card>
      )}
      {mod && <ModerationQueue />}
      {posts.length === 0 && <Empty text="No wins posted yet. Be the first." />}
      {posts.map((p) => {
        const counts = REACTIONS.map((e) => ({ e, n: rx.filter((r) => r.post_id === p.id && r.emoji === e).length, mine: rx.some((r) => r.post_id === p.id && r.emoji === e && r.user_id === me) }));
        return (
          <Card key={p.id} title={p.title} meta={`${p.author_name ?? 'A Masterminds member'} · ${new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}>
            {p.hidden && <Chip k="warn">hidden</Chip>}
            {p.line && <div style={{ fontSize: 15 }}>{p.line}</div>}
            {p.photo_path && <img src={photoUrl(p.photo_path)} alt="" loading="lazy" style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 12 }} />}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {counts.map((c) => <button key={c.e} className={`mm-btn ${c.mine ? 'mm-btn--primary' : ''}`} style={{ height: 34, padding: '0 12px' }} onClick={() => void react(p, c.e)} aria-label={`React ${c.e}`}>{c.e}{c.n ? ` ${c.n}` : ''}</button>)}
              <div style={{ flex: 1 }} />
              {p.user_id === me ? <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => void supabase.from('feed_posts').delete().eq('id', p.id).then(() => setPosts((x) => x.filter((y) => y.id !== p.id)))}>Delete</button> : <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => void report(p)}>Report</button>}
              {isOwner && p.user_id !== me && <><button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => void hide(p, !p.hidden)}>{p.hidden ? 'Unhide' : 'Hide'}</button><button className="mm-btn" style={{ height: 32, fontSize: 13, color: 'var(--danger)' }} onClick={() => void suspend(p)}>Suspend</button></>}
            </div>
          </Card>
        );
      })}
      <div ref={sentinel} style={{ height: 1 }} />
      {compose && <Composer win={compose} onClose={() => setCompose(null)} onPosted={() => { setCompose(null); void loadPage(); }} />}
    </Page>
  );
}

function Composer({ win, onClose, onPosted }: { win: WinInput; onClose: () => void; onPosted: () => void }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState(win.kind === 'manual' ? '' : winCard(win, false).title);
  const [line, setLine] = useState(winCard(win, false).line);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const sensitive = win.kind === 'macros' || win.kind === 'money' || win.kind === 'workout';
  useEffect(() => { if (win.kind !== 'manual') { const c = winCard(win, show); setLine(c.line); } }, [show, win]);
  const post = async () => {
    setBusy(true); setErr('');
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id; if (!uid) { setBusy(false); return; }
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', since);
    if (!canPost(count ?? 0)) { setBusy(false); setErr(`That's ${FEED_DAILY_LIMIT} posts today, the daily limit.`); return; }
    let photo: string | null = null;
    if (file) { const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '')}`; const up = await supabase.storage.from('feed-photos').upload(path, file); if (!up.error) photo = path; }
    const { data: s } = await supabase.from('user_setup').select('display_name').maybeSingle();
    const c = winCard(win, show);
    const { error } = await supabase.from('feed_posts').insert({ kind: win.kind, title: (title || c.title).slice(0, 120), line: line.slice(0, 280) || null, photo_path: photo, data: c.data, show_numbers: show, author_name: (s as { display_name?: string } | null)?.display_name ?? null });
    setBusy(false);
    if (error) { setErr(error.message.includes('row-level') ? 'Posting is paused for your account, or you hit today\'s limit.' : error.message); return; }
    onPosted();
  };
  return (
    <Sheet title="Share a win" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field l="Title"><input style={field} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field l="Add a line"><input style={field} value={line} maxLength={280} onChange={(e) => setLine(e.target.value)} /></Field>
        <Field l="Photo (optional)"><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        {sensitive && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show my numbers on this post</label>}
        {err && <div style={{ color: 'var(--danger)', fontSize: 13.5 }}>{err}</div>}
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={busy || !(title || win.kind !== 'manual')} onClick={() => void post()}>{busy ? 'Posting…' : 'Post to the Feed'}</button>
      </div>
    </Sheet>
  );
}

function ModerationQueue() {
  const [reports, setReports] = useState<{ id: string; post_id: string; reason: string | null; created_at: string; feed_posts: { title: string; user_id: string; hidden: boolean } | null }[]>([]);
  const load = useCallback(async () => { const { data } = await supabase.from('feed_reports').select('id,post_id,reason,created_at,feed_posts(title,user_id,hidden)').is('resolved_at', null).order('created_at'); setReports((data ?? []) as unknown as typeof reports); }, []);
  useEffect(() => { void load(); }, [load]);
  const resolve = async (id: string, postId: string, hide: boolean) => { if (hide) await supabase.from('feed_posts').update({ hidden: true }).eq('id', postId); await supabase.from('feed_reports').update({ resolved_at: new Date().toISOString() }).eq('id', id); await load(); };
  return (
    <Card title="Moderation queue" meta={`${reports.length} open`}>
      {reports.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No open reports.</div>}
      {reports.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>“{r.feed_posts?.title ?? 'post'}” — {r.reason}</span>
          <button className="mm-btn" style={{ height: 32 }} onClick={() => void resolve(r.id, r.post_id, true)}>Hide post</button>
          <button className="mm-btn" style={{ height: 32 }} onClick={() => void resolve(r.id, r.post_id, false)}>Dismiss</button>
        </div>
      ))}
    </Card>
  );
}
