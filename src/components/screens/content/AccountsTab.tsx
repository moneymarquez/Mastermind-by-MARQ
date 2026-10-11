import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { useSocialAccounts } from '../../../data/useContentEngine';
import type { SocialAccount, ContentItem, Platform, Owner, Format, SocialPost } from '../../../data/contentEngine';
import { PLATFORMS, PLATFORM, OWNERS, FORMATS, followerChange30, avgViews30, postingStreakWeeks, accountHealth, HEALTH_LABEL, HEALTH_COLOR, bestPostThisWeek, nextScheduled, latestMetrics, gradePost, GRADE_COLOR, linePath, compact } from '../../../data/contentEngine';
import { dateStr } from '../../../data/time';
import { E, Badge, Drawer, Metric, Section, TeachingEmpty, btn, field, label } from '../ecom/ecomShared';
import { askConfirm } from '../../../lib/confirm';
import { api as callApi } from '../../../lib/api';
import { useModule } from '../../mm/Page';

type Api = ReturnType<typeof useSocialAccounts>;
interface Props { api: Api; items: ContentItem[]; newOpen: boolean; onCloseNew: () => void; onOpenPlan: () => void }

/** §2.1 Accounts (home) — a card per account. C1: every number is typed
 *  in through "Log numbers"; C2 replaces the source with the APIs and the
 *  cards don't change. */
export default function AccountsTab({ api, items, newOpen, onCloseNew, onOpenPlan }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const today = dateStr(new Date());
  const open = api.accounts.find((a) => a.id === openId) ?? null;
  const { isOwner } = useModule();
  const [seedMsg, setSeedMsg] = useState('');
  const own = api.accounts.filter((a) => a.owner === 'mastermind' || a.owner === 'madebymarq' || a.owner === 'personal').length;
  const [syncMsg, setSyncMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const sync = async () => {
    setSyncing(true); setSyncMsg('');
    const r = await callApi<{ results?: { handle: string; ok: boolean; detail: string }[]; error?: string }>('/api/content/sync-accounts', { body: {} });
    setSyncing(false);
    setSyncMsg(r.error ?? ((r.results ?? []).map((x) => `${x.ok ? '✓' : '✕'} @${x.handle}: ${x.detail}`).join('\n') || 'No Instagram accounts to sync.'));
    await api.reload();
  };
  const seed = async () => { const r = await callApi<{ added?: number; error?: string }>('/api/content/own-accounts', { body: {} }); setSeedMsg(r.error ?? `Added ${r.added ?? 0} account${r.added === 1 ? '' : 's'}. Connect each in Setup → Accounts.`); await api.reload(); };
  // Brief §3.4: 3–5 accounts, every post a unique variant.
  const perOwner = Object.values(api.accounts.reduce<Record<string, number>>((m, a) => { m[a.owner] = (m[a.owner] ?? 0) + 1; return m; }, {}));

  return (
    <div>
      {api.error && <div style={{ color: E.red, marginBottom: 10 }}>{api.error}</div>}
      <div style={{ ...E.card, padding: 12, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', fontSize: 'var(--text-caption)', color: E.muted, lineHeight: 1.5 }}>
          <strong style={{ color: E.text }}>Run 3–5 accounts, every post a unique variant.</strong> A different hook, caption and cut on each. The same clip posted identically across many accounts is what Instagram and TikTok flag as spam, so the Post Planner holds an identical caption + video going to two accounts on the same day.
          {perOwner.some((n) => n > 5) && <div style={{ color: E.amber, marginTop: 4 }}>You have more than 5 accounts under one owner; that's past where variants stay genuinely different.</div>}
        </div>
        {isOwner && own < 6 && <button style={btn('ghost')} onClick={() => void seed()}>Add Masterminds, Made by Marq + personal accounts</button>}
        {isOwner && <button style={btn('primary')} disabled={syncing} onClick={() => void sync()}>{syncing ? 'Syncing…' : 'Sync real numbers from Instagram'}</button>}
        {syncMsg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, width: '100%', whiteSpace: 'pre-line' }}>{syncMsg}</div>}
        {seedMsg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, width: '100%' }}>{seedMsg}</div>}
      </div>
      {!api.loading && api.accounts.length === 0 && (
        <TeachingEmpty what="No accounts yet. Add every account this engine will run: Mastermind, Made by Marq, your personal one, each e-comm brand." worker="you for now — once Instagram and TikTok are connected, the numbers fill in by themselves" />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: api.accounts.length ? 0 : 12 }}>
        {api.accounts.map((a) => <AccountCard key={a.id} a={a} api={api} items={items} today={today} onOpen={() => setOpenId(a.id)} onLog={() => setLogId(a.id)} onOpenPlan={onOpenPlan} />)}
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 14, lineHeight: 1.5 }}>
        Followers change is against the snapshot from 30 days ago. Avg views is the last 30 days of posts with a number. Streak counts consecutive weeks with a post. Switch Instagram accounts to Business or Creator before C2 or the API returns no insights.
      </div>
      {newOpen && <AccountDrawer api={api} onClose={onCloseNew} />}
      {open && <AccountDetail a={open} api={api} items={items} today={today} onClose={() => setOpenId(null)} onOpenPlan={onOpenPlan} />}
      {logId && <LogNumbersDrawer a={api.accounts.find((x) => x.id === logId)!} api={api} onClose={() => setLogId(null)} />}
    </div>
  );
}

function Avatar({ a, size = 40 }: { a: SocialAccount; size?: number }) {
  const p = PLATFORM[a.platform];
  return a.avatar_url
    ? <img src={a.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: p.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.34, flexShrink: 0 }}>{p.short}</div>;
}

function AccountCard({ a, api, items, today, onOpen, onLog, onOpenPlan }: { a: SocialAccount; api: Api; items: ContentItem[]; today: string; onOpen: () => void; onLog: () => void; onOpenPlan: () => void }) {
  const posts = api.posts.filter((p) => p.account_id === a.id);
  const snaps = api.snapshots[a.id] ?? [];
  const change = followerChange30(a, snaps);
  const avg = avgViews30(posts, api.metrics);
  const streak = postingStreakWeeks(posts);
  const health = accountHealth(posts, change);
  const best = bestPostThisWeek(posts, api.metrics);
  const next = nextScheduled(items.filter((i) => i.account_id === a.id), today);
  const trend = change.delta == null ? '' : change.delta > 0 ? `↑${compact(change.delta)}` : change.delta < 0 ? `↓${compact(-change.delta)}` : '→0';
  return (
    <div style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={onOpen}>
        <Avatar a={a} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{a.handle.replace(/^@/, '')}</div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{PLATFORM[a.platform].label} · {OWNERS.find((o) => o.id === a.owner)?.label}</div>
        </div>
        <Badge color={HEALTH_COLOR[health]}>{HEALTH_LABEL[health]}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Metric label="Followers" value={compact(change.now)} trend={trend} asOf={a.followers != null ? a.updated_at : null} />
        <Metric label="Avg views · 30d" value={compact(avg == null ? null : Math.round(avg))} />
        <Metric label="Streak" value={String(streak)} unit="wk" />
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 'var(--text-caption)', color: E.muted, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div><span style={label}>Best this week</span> {best ? <>{best.post.hook || best.post.caption?.slice(0, 50) || best.post.type} · <strong>{compact(best.views)}</strong> views</> : '— no measured post this week'}</div>
        <div><span style={label}>Next</span> {next ? <span style={{ cursor: 'pointer' }} onClick={onOpen}>{next.concept} · {next.scheduled_for}{next.scheduled_time ? ` ${next.scheduled_time.slice(0, 5)}` : ''}</span> : <span>nothing scheduled — <span style={{ color: E.green, cursor: 'pointer' }} onClick={onOpenPlan}>plan the week</span></span>}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn('primary')} onClick={onLog}>Log numbers</button>
        <button style={btn('ghost')} onClick={onOpen}>Open</button>
      </div>
    </div>
  );
}
function AccountDrawer({ api, a, onClose }: { api: Api; a?: SocialAccount; onClose: () => void }) {
  const [platform, setPlatform] = useState<Platform>(a?.platform ?? 'instagram');
  const [handle, setHandle] = useState(a?.handle ?? '');
  const [owner, setOwner] = useState<Owner>(a?.owner ?? 'personal');
  const [displayName, setDisplayName] = useState(a?.display_name ?? '');
  const [followers, setFollowers] = useState(a?.followers != null ? String(a.followers) : '');
  const [goal, setGoal] = useState(String(a?.posts_per_week_goal ?? 3));
  const [voice, setVoice] = useState(a?.voice ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!handle.trim() || busy) return;
    setBusy(true);
    const base = { platform, handle: handle.trim().replace(/^@/, ''), owner, display_name: displayName.trim() || null, posts_per_week_goal: Number(goal) || 3, voice: voice.trim() || null };
    if (a) await api.updateAccount(a.id, base);
    else await api.createAccount({ ...base, followers: followers.trim() ? Number(followers) : null });
    setBusy(false); onClose();
  };
  return (
    <Drawer open onClose={onClose} title={a ? `Edit @${a.handle}` : 'Add account'} subtitle="Each account gets its own voice — pulled from the brand record when there is one." width={520}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select style={{ ...field, width: 'auto' }} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <select style={{ ...field, width: 'auto' }} value={owner} onChange={(e) => setOwner(e.target.value as Owner)}>{OWNERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
      </div>
      <div style={{ marginTop: 12 }}><div style={{ ...label, marginBottom: 4 }}>Handle</div><input style={field} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@madebymarq" /></div>
      <div style={{ marginTop: 12 }}><div style={{ ...label, marginBottom: 4 }}>Display name</div><input style={field} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!a && <div style={{ flex: 1 }}><div style={{ ...label, marginBottom: 4 }}>Followers today</div><input style={field} inputMode="numeric" value={followers} onChange={(e) => setFollowers(e.target.value)} /></div>}
        <div style={{ flex: 1 }}><div style={{ ...label, marginBottom: 4 }}>Posts / week goal</div><input style={field} inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 12 }}><div style={{ ...label, marginBottom: 4 }}>Voice</div><textarea style={{ ...field, minHeight: 80, resize: 'vertical' }} value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="How this account talks. Short, direct, no fluff. Says 'we' for Made by Marq…" /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={btn('primary')} disabled={busy} onClick={save}>{busy ? 'Saving…' : a ? 'Save' : 'Add account'}</button>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        {a && <button style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={async () => { if (await askConfirm(`Remove @${a.handle} and its posts and numbers?`)) { await api.removeAccount(a.id); onClose(); } }}>Remove</button>}
      </div>
    </Drawer>
  );
}

function LogNumbersDrawer({ a, api, onClose }: { a: SocialAccount; api: Api; onClose: () => void }) {
  const [followers, setFollowers] = useState(a.followers != null ? String(a.followers) : '');
  const [avg, setAvg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Drawer open onClose={onClose} title={`Log today's numbers · @${a.handle}`} subtitle="Read them off the app's insights. One snapshot a day is plenty." width={440}>
      <div style={{ ...label, marginBottom: 4 }}>Followers now</div>
      <input style={field} inputMode="numeric" value={followers} onChange={(e) => setFollowers(e.target.value)} autoFocus />
      <div style={{ ...label, marginBottom: 4, marginTop: 12 }}>Avg views per post (optional)</div>
      <input style={field} inputMode="numeric" value={avg} onChange={(e) => setAvg(e.target.value)} placeholder="What the app shows as average, if it does" />
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={btn('primary')} disabled={busy || !followers.trim()} onClick={async () => { setBusy(true); await api.logAccountMetrics(a.id, Number(followers), avg.trim() ? Number(avg) : null); setBusy(false); onClose(); }}>{busy ? 'Saving…' : 'Save snapshot'}</button>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
      </div>
    </Drawer>
  );
}

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(/[,\s]/g, '')));

/** A profile-page preview of the account, in Masterminds' own look: a ringed avatar, three numbers, a bio line, and a tile grid of what's posted and what's planned. */
function ProfilePreview({ a, posts, metrics, planned, followers, avg }: { a: SocialAccount; posts: SocialPost[]; metrics: Api['metrics']; planned: ContentItem[]; followers: number | null; avg: number | null }) {
  const recent = [...posts].sort((x, y) => +new Date(y.posted_at) - +new Date(x.posted_at)).slice(0, 9);
  const upcoming = planned.slice(0, Math.max(0, 9 - recent.length));
  const tiles = [...recent.map((p) => ({ key: p.id, kind: 'posted' as const, img: p.thumbnail_url, text: p.hook || p.caption || '', views: latestMetrics(metrics[p.id] ?? [])?.views ?? null, type: p.type })), ...upcoming.map((i) => ({ key: i.id, kind: 'planned' as const, img: i.thumbnail_url, text: i.concept, views: null as number | null, type: i.format as string }))];
  const [tab, setTab] = useState<'posted' | 'planned'>('posted');
  const shown = tiles.filter((t) => t.kind === tab);
  const bio = a.voice?.trim() || `${OWNERS.find((o) => o.id === a.owner)?.label ?? ''} · ${PLATFORM[a.platform].label}`;
  return (
    <div style={{ ...E.card, padding: 16, marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ padding: 3, borderRadius: '50%', background: 'conic-gradient(from 200deg, var(--accent), var(--success), var(--accent))', flexShrink: 0 }}>
          <div style={{ padding: 3, borderRadius: '50%', background: 'var(--surface)' }}><Avatar a={a} size={72} /></div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', gap: 4 }}>
          {[['Posts', String(posts.length)], ['Followers', compact(followers)], ['Avg views', compact(avg == null ? null : Math.round(avg))]].map(([k, v]) => (
            <div key={k}><div style={{ fontSize: 20, fontWeight: 700, color: E.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div><div style={{ fontSize: 12, color: E.faint }}>{k}</div></div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, color: E.text }}>{a.display_name || a.handle}</div>
        <div style={{ fontSize: 13.5, color: E.muted, lineHeight: 1.45 }}>{bio}</div>
        <div style={{ fontSize: 12, color: E.faint, marginTop: 2 }}>@{a.handle} · {a.connected ? 'connected' : 'not connected'} · {a.posts_per_week_goal} posts a week</div>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 10px' }}>
        {(['posted', 'planned'] as const).map((t) => <button key={t} onClick={() => setTab(t)} style={{ ...btn(tab === t ? 'primary' : 'ghost'), minHeight: 32, padding: '0 14px', fontSize: 13, borderRadius: 999 }}>{t === 'posted' ? `Posted ${recent.length}` : `Planned ${upcoming.length}`}</button>)}
      </div>
      {shown.length === 0 ? <div style={{ fontSize: 13, color: E.faint, padding: '10px 0' }}>{tab === 'posted' ? 'Nothing posted yet. Log or publish a post and it appears here.' : 'Nothing planned. Open the plan to schedule the week.'}</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {shown.map((t, i) => (
            <div key={t.key} style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: 12, overflow: 'hidden', border: t.kind === 'planned' ? `1px dashed ${E.border}` : `1px solid ${E.border}`, background: t.img ? 'var(--surface-4)' : `linear-gradient(${140 + i * 25}deg, color-mix(in srgb, var(--accent) 22%, var(--surface)), color-mix(in srgb, var(--success) 18%, var(--surface)))` }}>
              {t.img && <img src={t.img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              {!t.img && <div style={{ position: 'absolute', inset: 0, padding: 8, fontSize: 12, lineHeight: 1.3, color: E.text, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden' }}>{t.text.slice(0, 70) || FORMATS.find((f) => f.id === t.type)?.label}</div>}
              <span style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--bg) 78%, transparent)', color: E.text }}>{t.kind === 'planned' ? 'Planned' : `▶ ${compact(t.views)}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountDetail({ a, api, items, today, onClose, onOpenPlan }: { a: SocialAccount; api: Api; items: ContentItem[]; today: string; onClose: () => void; onOpenPlan: () => void }) {
  const [edit, setEdit] = useState(false);
  const [addPost, setAddPost] = useState(false);
  const [logFor, setLogFor] = useState<SocialPost | null>(null);
  const posts = api.posts.filter((p) => p.account_id === a.id);
  const snaps = api.snapshots[a.id] ?? [];
  const change = followerChange30(a, snaps);
  const avg = avgViews30(posts, api.metrics);
  const path = linePath(snaps.map((s) => s.followers), 300, 60);
  const ranked = posts.map((p) => ({ p, m: latestMetrics(api.metrics[p.id] ?? []) })).sort((x, y) => (y.m?.views ?? -1) - (x.m?.views ?? -1));
  const next = nextScheduled(items.filter((i) => i.account_id === a.id), today);
  const row: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' };

  return (
    <Drawer open onClose={onClose} title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Avatar a={a} size={28} />@{a.handle}</span>} subtitle={`${PLATFORM[a.platform].label} · ${OWNERS.find((o) => o.id === a.owner)?.label}${a.voice ? ` · voice: ${a.voice.slice(0, 60)}` : ''}`} width={640}
      actions={<button style={btn('ghost')} onClick={() => setEdit(true)}>Edit</button>}>
      <ProfilePreview a={a} posts={posts} metrics={api.metrics} planned={items.filter((i) => i.account_id === a.id && !i.posted_post_id && !!i.scheduled_for && i.scheduled_for >= today)} followers={change.now} avg={avg} />
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <Metric label="Followers" value={compact(change.now)} trend={change.delta == null ? '' : change.delta >= 0 ? `↑${compact(change.delta)} / 30d` : `↓${compact(-change.delta)} / 30d`} big />
        <Metric label="Avg views · 30d" value={compact(avg == null ? null : Math.round(avg))} big />
        <Metric label="Posts logged" value={String(posts.length)} />
        <Metric label="Goal" value={String(a.posts_per_week_goal)} unit="/ wk" />
      </div>
      <Section title="Followers over time" aside={<span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{snaps.length} snapshot{snaps.length === 1 ? '' : 's'}</span>}>
        <div style={{ ...E.card, padding: 12 }}>
          {path ? <svg width="100%" height={60} viewBox="0 0 300 60" preserveAspectRatio="none" aria-label="Followers"><path d={path} fill="none" stroke={E.green} strokeWidth={2} strokeLinejoin="round" /></svg>
            : <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Two snapshots draw a line. Log numbers once a day and it fills in; once the account is connected it updates itself.</div>}
        </div>
      </Section>
      <Section title="Next up" aside={<button style={{ ...btn('ghost'), padding: '4px 10px', fontSize: 12 }} onClick={() => { onClose(); onOpenPlan(); }}>Open plan</button>}>
        <div style={{ fontSize: 'var(--text-body)', color: E.muted }}>{next ? `${next.concept} · ${next.scheduled_for}${next.scheduled_time ? ` ${next.scheduled_time.slice(0, 5)}` : ''}` : 'Nothing scheduled for this account.'}</div>
      </Section>
      <Section title="Posts by views" aside={<button style={{ ...btn('primary'), padding: '4px 10px', fontSize: 12 }} onClick={() => setAddPost(true)}>＋ Add post</button>}>
        {ranked.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Add the posts you've published with their numbers. Each one gets a grade out of 4 against this account's 30-day average.</div>}
        {ranked.slice(0, 10).map(({ p, m }) => {
          const g = gradePost(m?.views, avg);
          return (
            <div key={p.id} style={row}>
              {p.thumbnail_url && <img src={p.thumbnail_url} alt="" style={{ width: 44, height: 56, objectFit: 'cover', borderRadius: 6 }} />}
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.hook || p.caption?.slice(0, 60) || FORMATS.find((f) => f.id === p.type)?.label}</div>
                <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{new Date(p.posted_at).toLocaleDateString()} · {FORMATS.find((f) => f.id === p.type)?.label}{p.url && <> · <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: E.blue }}>open</a></>}{m && <> · as of {new Date(m.captured_at).toLocaleDateString()}</>}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 12, color: E.muted }}>
                <span title="views">👁 {compact(m?.views)}</span><span title="likes">♥ {compact(m?.likes)}</span><span title="saves">🔖 {compact(m?.saves)}</span><span title="shares">↗ {compact(m?.shares)}</span>
              </div>
              {g ? <Badge color={GRADE_COLOR[g.grade]} title={g.reason}>{g.grade}/4</Badge> : <Badge color={E.faint} title="Needs views and a 30-day average">—/4</Badge>}
              <button style={{ ...btn('ghost'), padding: '4px 8px', fontSize: 12 }} onClick={() => setLogFor(p)}>Update</button>
            </div>
          );
        })}
      </Section>
      <Section title="What's working">
        <TeachingEmpty what="Top 10 by saves and shares, best-time heatmap, and the Auditor's read (3 things to repeat, 3 to stop)." worker="the Account Auditor" connection="an Instagram or TikTok connection" />
      </Section>
      {edit && <AccountDrawer api={api} a={a} onClose={() => setEdit(false)} />}
      {addPost && <PostDrawer a={a} api={api} onClose={() => setAddPost(false)} />}
      {logFor && <PostMetricsDrawer p={logFor} api={api} onClose={() => setLogFor(null)} />}
    </Drawer>
  );
}

function PostDrawer({ a, api, onClose }: { a: SocialAccount; api: Api; onClose: () => void }) {
  const [url, setUrl] = useState(''); const [type, setType] = useState<Format>('reel'); const [hook, setHook] = useState(''); const [caption, setCaption] = useState('');
  const [date, setDate] = useState(dateStr(new Date())); const [thumb, setThumb] = useState('');
  const [views, setViews] = useState(''); const [likes, setLikes] = useState(''); const [comments, setComments] = useState(''); const [shares, setShares] = useState(''); const [saves, setSaves] = useState('');
  const [busy, setBusy] = useState(false);
  const inp = (v: string, on: (x: string) => void, ph: string) => <input style={field} inputMode="numeric" value={v} onChange={(e) => on(e.target.value)} placeholder={ph} />;
  return (
    <Drawer open onClose={onClose} title={`Add post · @${a.handle}`} subtitle="A published post and today's numbers. Update the numbers later as they grow." width={520}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select style={{ ...field, width: 'auto' }} value={type} onChange={(e) => setType(e.target.value as Format)}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        <input style={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Hook (first line)</div><input style={field} value={hook} onChange={(e) => setHook(e.target.value)} /></div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Link</div><input style={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" /></div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Thumbnail URL (optional)</div><input style={field} value={thumb} onChange={(e) => setThumb(e.target.value)} /></div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Caption</div><textarea style={{ ...field, minHeight: 60, resize: 'vertical' }} value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
      <div style={{ ...label, marginTop: 12, marginBottom: 4 }}>Numbers today</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
        {inp(views, setViews, 'views')}{inp(likes, setLikes, 'likes')}{inp(comments, setComments, 'comments')}{inp(shares, setShares, 'shares')}{inp(saves, setSaves, 'saves')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={btn('primary')} disabled={busy} onClick={async () => { setBusy(true); await api.addPost({ account_id: a.id, url: url.trim() || null, type, hook: hook.trim() || null, caption: caption.trim() || null, posted_at: new Date(`${date}T12:00:00`).toISOString(), thumbnail_url: thumb.trim() || null }, { views: num(views), likes: num(likes), comments: num(comments), shares: num(shares), saves: num(saves) }); setBusy(false); onClose(); }}>{busy ? 'Saving…' : 'Add post'}</button>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
      </div>
    </Drawer>
  );
}

function PostMetricsDrawer({ p, api, onClose }: { p: SocialPost; api: Api; onClose: () => void }) {
  const last = latestMetrics(api.metrics[p.id] ?? []);
  const s = (v: number | null | undefined) => (v == null ? '' : String(v));
  const [views, setViews] = useState(s(last?.views)); const [likes, setLikes] = useState(s(last?.likes)); const [comments, setComments] = useState(s(last?.comments)); const [shares, setShares] = useState(s(last?.shares)); const [saves, setSaves] = useState(s(last?.saves)); const [follows, setFollows] = useState(s(last?.follows));
  const [busy, setBusy] = useState(false);
  const inp = (l: string, v: string, on: (x: string) => void) => <div><div style={{ ...label, marginBottom: 4 }}>{l}</div><input style={field} inputMode="numeric" value={v} onChange={(e) => on(e.target.value)} /></div>;
  return (
    <Drawer open onClose={onClose} title="Update numbers" subtitle={p.hook || p.caption?.slice(0, 60) || p.type} width={440}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {inp('Views', views, setViews)}{inp('Likes', likes, setLikes)}{inp('Comments', comments, setComments)}{inp('Shares', shares, setShares)}{inp('Saves', saves, setSaves)}{inp('Follows from it', follows, setFollows)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={btn('primary')} disabled={busy} onClick={async () => { setBusy(true); await api.logPostMetrics(p.id, { views: num(views), likes: num(likes), comments: num(comments), shares: num(shares), saves: num(saves), follows: num(follows) }); setBusy(false); onClose(); }}>{busy ? 'Saving…' : 'Save'}</button>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        <button style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={async () => { if (await askConfirm('Remove this post and its numbers?')) { await api.removePost(p.id); onClose(); } }}>Remove</button>
      </div>
    </Drawer>
  );
}
